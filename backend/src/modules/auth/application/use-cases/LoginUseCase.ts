import { AppError } from '../../../../common/errors/AppError';
import { env } from '../../../../config/env';
import { verifyPassword } from '../../../../infrastructure/security/hash';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../../../../infrastructure/security/jwt';
import { LoginDto } from '../dto/LoginDto';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class LoginUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async validateCredentials(input: LoginDto): Promise<{ userId: string; email: string; roles: string[] }> {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    return {
      userId: user.id,
      email: user.email,
      roles: user.roles,
    };
  }

  async issueTokensForUserId(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findById(userId);

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 404, 'USER_NOT_FOUND');
    }

    return this.issueTokens({
      userId: user.id,
      email: user.email,
      roles: user.roles,
    });
  }

  async execute(input: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const validated = await this.validateCredentials(input);
    return this.issueTokens(validated);
  }

  private async issueTokens(user: {
    userId: string;
    email: string;
    roles: string[];
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = signAccessToken({
      sub: user.userId,
      email: user.email,
      roles: user.roles,
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await this.userRepository.storeRefreshToken({
      userId: user.userId,
      tokenHash: refreshTokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }
}
