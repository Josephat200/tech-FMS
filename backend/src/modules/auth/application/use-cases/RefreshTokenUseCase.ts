import { AppError } from '../../../../common/errors/AppError';
import { env } from '../../../../config/env';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../../../../infrastructure/security/jwt';
import { RefreshTokenDto } from '../dto/RefreshTokenDto';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class RefreshTokenUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    const incomingTokenHash = hashToken(input.refreshToken);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const userId = await this.userRepository.rotateRefreshToken({
      currentTokenHash: incomingTokenHash,
      newTokenHash: refreshTokenHash,
      newExpiresAt: expiresAt,
    });

    if (!userId) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await this.userRepository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError('User not found', 401, 'UNAUTHORIZED');
    }

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });

    return { accessToken, refreshToken };
  }
}
