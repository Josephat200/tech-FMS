import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../../common/middlewares/async-handler';
import { authenticate } from '../../../../common/middlewares/authenticate';
import { authorize } from '../../../../common/middlewares/authorize';
import {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} from '../../../../common/middlewares/auth-rate-limit';
import { PgUserRepository } from '../../infrastructure/repositories/PgUserRepository';
import { LoginUseCase } from '../../application/use-cases/LoginUseCase';
import { RegisterUseCase } from '../../application/use-cases/RegisterUseCase';
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase';
import { LogoutUseCase } from '../../application/use-cases/LogoutUseCase';
import { AdminProvisionUserUseCase } from '../../application/use-cases/AdminProvisionUserUseCase';
import { AuthController } from '../controllers/AuthController';
import { EmailService } from '../../../../infrastructure/notifications/EmailService';
import { MfaService } from '../../application/services/MfaService';

const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email(),
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

const adminCreateUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'HR', 'AUDITOR', 'DEPARTMENT_MANAGER', 'USER']),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(12).max(128),
});

const verifyMfaSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

const refreshSchema = z
  .object({
    refreshToken: z.string().min(30).optional(),
  })
  .default({});

const logoutSchema = z
  .object({
    refreshToken: z.string().min(30).optional(),
  })
  .default({});

const userRepository = new PgUserRepository();
const loginUseCase = new LoginUseCase(userRepository);
const registerUseCase = new RegisterUseCase(userRepository);
const refreshTokenUseCase = new RefreshTokenUseCase(userRepository);
const logoutUseCase = new LogoutUseCase(userRepository);
const emailService = new EmailService();
const adminProvisionUserUseCase = new AdminProvisionUserUseCase(userRepository, emailService);
const mfaService = new MfaService(emailService);
const authController = new AuthController(
  loginUseCase,
  registerUseCase,
  refreshTokenUseCase,
  logoutUseCase,
  adminProvisionUserUseCase,
  mfaService,
);

export const authRouter = Router();

authRouter.post('/register', registerLimiter, asyncHandler(async (_req, res) => {
  res.status(403).json({
    success: false,
    error: {
      code: 'SELF_REGISTRATION_DISABLED',
      message: 'Public registration is disabled. Contact an administrator for access.',
    },
  });
}));

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, _res, next) => {
    req.body = loginSchema.parse(req.body);
    req.body.email = req.body.email.toLowerCase();
    next();
  }),
  asyncHandler(authController.login),
);

authRouter.post(
  '/login/verify-mfa',
  loginLimiter,
  asyncHandler(async (req, _res, next) => {
    req.body = verifyMfaSchema.parse(req.body);
    next();
  }),
  asyncHandler(authController.verifyMfa),
);

authRouter.post(
  '/refresh',
  refreshLimiter,
  asyncHandler(async (req, _res, next) => {
    req.body = refreshSchema.parse(req.body);
    next();
  }),
  asyncHandler(authController.refresh),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, _res, next) => {
    req.body = logoutSchema.parse(req.body);
    next();
  }),
  asyncHandler(authController.logout),
);

authRouter.get('/me', authenticate, asyncHandler(authController.me));

authRouter.post(
  '/admin/users',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.body = adminCreateUserSchema.parse(req.body);
    req.body.email = req.body.email.toLowerCase();
    next();
  }),
  asyncHandler(authController.adminCreateUser),
);

authRouter.get(
  '/admin-only',
  authenticate,
  authorize('ADMIN'),
  asyncHandler(async (_req, res) => {
    res.status(200).json({ success: true, data: { message: 'Admin access granted' } });
  }),
);
