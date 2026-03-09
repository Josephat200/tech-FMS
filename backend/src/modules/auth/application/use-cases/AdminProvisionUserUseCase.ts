import { randomBytes } from 'crypto';
import { AppError } from '../../../../common/errors/AppError';
import { hashPassword } from '../../../../infrastructure/security/hash';
import { EmailService } from '../../../../infrastructure/notifications/EmailService';
import { UserRepository } from '../../domain/repositories/UserRepository';

export type AdminProvisionUserDto = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'HR' | 'AUDITOR' | 'DEPARTMENT_MANAGER' | 'USER';
};

export class AdminProvisionUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(input: AdminProvisionUserDto): Promise<{ userId: string; email: string; role: string }> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new AppError('Email is already registered', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await this.userRepository.create({
      username: input.username,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    await this.userRepository.assignRole(user.id, input.role);

    await this.emailService.sendAccountCreatedEmail({
      to: input.email,
      firstName: input.firstName,
      temporaryPassword,
      role: input.role,
    });

    return {
      userId: user.id,
      email: user.email,
      role: input.role,
    };
  }

  private generateTemporaryPassword(): string {
    const random = randomBytes(18).toString('base64url');
    return `Tmp#${random}9aA`;
  }
}
