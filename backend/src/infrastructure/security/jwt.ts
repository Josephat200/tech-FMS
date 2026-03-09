import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../config/env';

export type AuthTokenPayload = {
  sub: string;
  email: string;
  roles: string[];
};

export function signAccessToken(payload: AuthTokenPayload): string {
  const expiresIn = env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'];

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
  }) as AuthTokenPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
