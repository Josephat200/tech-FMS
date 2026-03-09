import crypto from 'crypto';
import { AppError } from '../../../../common/errors/AppError';
import { env } from '../../../../config/env';
import { pgPool } from '../../../../infrastructure/db/postgres';
import { EmailService } from '../../../../infrastructure/notifications/EmailService';

export class MfaService {
  constructor(private readonly emailService: EmailService) {}

  async createLoginChallenge(input: {
    userId: string;
    email: string;
  }): Promise<{
    challengeId: string;
    expiresAt: string;
    deliveryChannel: 'EMAIL' | 'DEV';
    devCode?: string;
  }> {
    const challengeId = crypto.randomUUID();
    const verificationCode = this.generateCode();
    const challengeHash = this.hashChallenge(challengeId, verificationCode);
    const expiresAt = new Date(Date.now() + env.MFA_CODE_EXPIRES_MINUTES * 60 * 1000);

    await pgPool.query(
      `
        UPDATE tech_rica.auth_mfa_challenges
        SET consumed_at = now()
        WHERE user_id = $1 AND purpose = 'LOGIN' AND consumed_at IS NULL
      `,
      [input.userId],
    );

    await pgPool.query(
      `
        INSERT INTO tech_rica.auth_mfa_challenges (
          challenge_id,
          user_id,
          purpose,
          challenge_hash,
          delivery_channel,
          expires_at,
          max_attempts
        )
        VALUES ($1, $2, 'LOGIN', $3, $4, $5, $6)
      `,
      [
        challengeId,
        input.userId,
        challengeHash,
        env.NODE_ENV === 'production' ? 'EMAIL' : 'DEV',
        expiresAt,
        env.MFA_MAX_ATTEMPTS,
      ],
    );

    await this.emailService.sendLoginVerificationCode({
      to: input.email,
      code: verificationCode,
      expiresInMinutes: env.MFA_CODE_EXPIRES_MINUTES,
    });

    const response: {
      challengeId: string;
      expiresAt: string;
      deliveryChannel: 'EMAIL' | 'DEV';
      devCode?: string;
    } = {
      challengeId,
      expiresAt: expiresAt.toISOString(),
      deliveryChannel: env.NODE_ENV === 'production' ? 'EMAIL' : 'DEV',
    };

    if (env.NODE_ENV !== 'production' && env.MFA_DEV_BYPASS_CODE) {
      response.devCode = env.MFA_DEV_BYPASS_CODE;
    }

    return response;
  }

  async verifyLoginChallenge(input: { challengeId: string; code: string }): Promise<string> {
    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');

      const challengeResult = await client.query<{
        challenge_id: string;
        user_id: string;
        challenge_hash: string;
        expires_at: Date;
        consumed_at: Date | null;
        attempt_count: number;
        max_attempts: number;
      }>(
        `
          SELECT challenge_id, user_id, challenge_hash, expires_at, consumed_at, attempt_count, max_attempts
          FROM tech_rica.auth_mfa_challenges
          WHERE challenge_id = $1
          FOR UPDATE
        `,
        [input.challengeId],
      );

      if (!challengeResult.rowCount) {
        throw new AppError('MFA challenge not found', 404, 'MFA_CHALLENGE_NOT_FOUND');
      }

      const challenge = challengeResult.rows[0];

      if (challenge.consumed_at) {
        throw new AppError('MFA challenge has already been used', 400, 'MFA_CHALLENGE_ALREADY_USED');
      }

      if (challenge.expires_at.getTime() < Date.now()) {
        throw new AppError('MFA challenge has expired', 401, 'MFA_CHALLENGE_EXPIRED');
      }

      if (challenge.attempt_count >= challenge.max_attempts) {
        throw new AppError('MFA challenge attempt limit reached', 429, 'MFA_ATTEMPTS_EXCEEDED');
      }

      const expectedHash = this.hashChallenge(input.challengeId, input.code);
      const isBypassCodeValid =
        env.NODE_ENV !== 'production' &&
        Boolean(env.MFA_DEV_BYPASS_CODE) &&
        input.code === env.MFA_DEV_BYPASS_CODE;

      if (!isBypassCodeValid && !this.safeCompareHash(challenge.challenge_hash, expectedHash)) {
        await client.query(
          `
            UPDATE tech_rica.auth_mfa_challenges
            SET attempt_count = attempt_count + 1
            WHERE challenge_id = $1
          `,
          [input.challengeId],
        );

        throw new AppError('Invalid verification code', 401, 'MFA_CODE_INVALID');
      }

      await client.query(
        `
          UPDATE tech_rica.auth_mfa_challenges
          SET consumed_at = now()
          WHERE challenge_id = $1
        `,
        [input.challengeId],
      );

      await client.query('COMMIT');
      return challenge.user_id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private hashChallenge(challengeId: string, code: string): string {
    return crypto.createHash('sha256').update(`${challengeId}:${code}:${env.JWT_SECRET}`).digest('hex');
  }

  private safeCompareHash(storedHash: string, providedHash: string): boolean {
    const stored = Buffer.from(storedHash, 'hex');
    const provided = Buffer.from(providedHash, 'hex');

    if (stored.length !== provided.length) {
      return false;
    }

    return crypto.timingSafeEqual(stored, provided);
  }
}
