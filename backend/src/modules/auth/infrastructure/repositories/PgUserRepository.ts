import { pgPool } from '../../../../infrastructure/db/postgres';
import { User } from '../../domain/entities/User';
import {
  CreateUserInput,
  RefreshTokenRecord,
  RotateRefreshTokenInput,
  UserRepository,
} from '../../domain/repositories/UserRepository';

type DbRow = {
  user_id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  roles: string[];
};

export class PgUserRepository implements UserRepository {
  private readonly baseSelect = `
      SELECT
        u.user_id,
        u.email,
        u.password_hash,
        u.is_active,
        COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
      FROM tech_rica.users u
      LEFT JOIN tech_rica.user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN tech_rica.roles r ON r.role_id = ur.role_id
  `;

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      ${this.baseSelect}
      WHERE u.email = $1
      GROUP BY u.user_id, u.email, u.password_hash, u.is_active
      LIMIT 1
    `;

    const result = await pgPool.query<DbRow>(query, [email]);
    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.user_id,
      email: row.email,
      passwordHash: row.password_hash,
      isActive: row.is_active,
      roles: row.roles,
    };
  }

  async findById(userId: string): Promise<User | null> {
    const query = `
      ${this.baseSelect}
      WHERE u.user_id = $1
      GROUP BY u.user_id, u.email, u.password_hash, u.is_active
      LIMIT 1
    `;

    const result = await pgPool.query<DbRow>(query, [userId]);
    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.user_id,
      email: row.email,
      passwordHash: row.password_hash,
      isActive: row.is_active,
      roles: row.roles,
    };
  }

  async create(input: CreateUserInput): Promise<User> {
    const query = `
      INSERT INTO tech_rica.users (username, email, password_hash, first_name, last_name, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING user_id, email, password_hash, is_active
    `;

    const result = await pgPool.query<Omit<DbRow, 'roles'>>(query, [
      input.username,
      input.email,
      input.passwordHash,
      input.firstName,
      input.lastName,
    ]);

    const created = result.rows[0];
    return {
      id: created.user_id,
      email: created.email,
      passwordHash: created.password_hash,
      isActive: created.is_active,
      roles: [],
    };
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    const query = `
      INSERT INTO tech_rica.user_roles (user_id, role_id)
      SELECT $1, role_id
      FROM tech_rica.roles
      WHERE role_name = $2
      ON CONFLICT (user_id, role_id) DO NOTHING
    `;

    const result = await pgPool.query(query, [userId, roleName]);
    if (result.rowCount === 0) {
      throw new Error(`Role not found: ${roleName}`);
    }
  }

  async storeRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    const query = `
      INSERT INTO tech_rica.refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    await pgPool.query(query, [input.userId, input.tokenHash, input.expiresAt]);
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const query = `
      SELECT refresh_token_id, user_id, token_hash, expires_at, revoked_at
      FROM tech_rica.refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
    `;

    const result = await pgPool.query<{
      refresh_token_id: string;
      user_id: string;
      token_hash: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(query, [tokenHash]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      refreshTokenId: row.refresh_token_id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    };
  }

  async revokeRefreshToken(refreshTokenId: string): Promise<void> {
    const query = `
      UPDATE tech_rica.refresh_tokens
      SET revoked_at = now()
      WHERE refresh_token_id = $1
    `;
    await pgPool.query(query, [refreshTokenId]);
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<string | null> {
    const client = await pgPool.connect();

    try {
      await client.query('BEGIN');

      const currentTokenResult = await client.query<{
        refresh_token_id: string;
        user_id: string;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        `
          SELECT refresh_token_id, user_id, expires_at, revoked_at
          FROM tech_rica.refresh_tokens
          WHERE token_hash = $1
          FOR UPDATE
        `,
        [input.currentTokenHash],
      );

      if (currentTokenResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const currentToken = currentTokenResult.rows[0];
      if (currentToken.revoked_at || currentToken.expires_at.getTime() < Date.now()) {
        await client.query(
          `
            UPDATE tech_rica.refresh_tokens
            SET revoked_at = now()
            WHERE refresh_token_id = $1
          `,
          [currentToken.refresh_token_id],
        );
        await client.query('COMMIT');
        return null;
      }

      await client.query(
        `
          UPDATE tech_rica.refresh_tokens
          SET revoked_at = now()
          WHERE refresh_token_id = $1
        `,
        [currentToken.refresh_token_id],
      );

      await client.query(
        `
          INSERT INTO tech_rica.refresh_tokens (user_id, token_hash, expires_at)
          VALUES ($1, $2, $3)
        `,
        [currentToken.user_id, input.newTokenHash, input.newExpiresAt],
      );

      await client.query('COMMIT');
      return currentToken.user_id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
