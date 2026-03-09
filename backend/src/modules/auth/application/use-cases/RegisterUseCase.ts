import { AppError } from '../../../../common/errors/AppError';
import { hashPassword } from '../../../../infrastructure/security/hash';
import { RegisterDto } from '../dto/RegisterDto';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class RegisterUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: RegisterDto): Promise<{ userId: string; email: string }> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new AppError('Email is already registered', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await this.userRepository.create({
      username: input.username,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    await this.userRepository.assignRole(user.id, 'USER');

    return {
      userId: user.id,
      email: user.email,
    };
  }
}
