import { hashToken } from '../../../../infrastructure/security/jwt';
import { LogoutDto } from '../dto/LogoutDto';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class LogoutUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: LogoutDto): Promise<void> {
    const tokenHash = hashToken(input.refreshToken);
    const tokenRecord = await this.userRepository.findRefreshTokenByHash(tokenHash);

    if (tokenRecord && !tokenRecord.revokedAt) {
      await this.userRepository.revokeRefreshToken(tokenRecord.refreshTokenId);
    }
  }
}
