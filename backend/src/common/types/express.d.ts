import { AuthTokenPayload } from '../../infrastructure/security/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export {};
