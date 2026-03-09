import { User } from '../entities/User';

export type CreateUserInput = {
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
};

export type PersistRefreshTokenInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type RotateRefreshTokenInput = {
  currentTokenHash: string;
  newTokenHash: string;
  newExpiresAt: Date;
};

export type RefreshTokenRecord = {
  refreshTokenId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  assignRole(userId: string, roleName: string): Promise<void>;
  storeRefreshToken(input: PersistRefreshTokenInput): Promise<void>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(refreshTokenId: string): Promise<void>;
  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<string | null>;
}
