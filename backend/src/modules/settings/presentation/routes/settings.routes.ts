import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../../common/middlewares/async-handler';
import { authenticate } from '../../../../common/middlewares/authenticate';
import { authorize } from '../../../../common/middlewares/authorize';
import { EmailService } from '../../../../infrastructure/notifications/EmailService';
import { TransactionService } from '../../../accounting/application/services/TransactionService';
import { AdminProvisionUserUseCase } from '../../../auth/application/use-cases/AdminProvisionUserUseCase';
import { PgUserRepository } from '../../../auth/infrastructure/repositories/PgUserRepository';
import { SettingsService } from '../../application/services/SettingsService';
import { SettingsController } from '../controllers/SettingsController';

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'HR', 'AUDITOR', 'DEPARTMENT_MANAGER', 'USER']),
});

const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

const resetUserPasswordSchema = z.object({
  newPassword: z.string().trim().min(12).max(128),
});

const submitChangeRequestSchema = z.object({
  actionType: z.enum(['POST_JOURNAL_ENTRY']),
  targetResource: z.string().trim().min(1).max(200),
  payload: z.unknown(),
});

const rejectChangeRequestSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

const editingModeSchema = z.object({
  enabled: z.boolean(),
});

const userRepository = new PgUserRepository();
const emailService = new EmailService();
const adminProvisionUserUseCase = new AdminProvisionUserUseCase(userRepository, emailService);
const transactionService = new TransactionService();
const settingsService = new SettingsService(transactionService);
const settingsController = new SettingsController(settingsService, adminProvisionUserUseCase);

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.post(
  '/change-requests',
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'HR', 'AUDITOR', 'DEPARTMENT_MANAGER', 'USER'),
  asyncHandler(async (req, _res, next) => {
    req.body = submitChangeRequestSchema.parse(req.body);
    next();
  }),
  asyncHandler(settingsController.submitChangeRequest),
);

settingsRouter.get('/overview', authorize('ADMIN'), asyncHandler(settingsController.getOverview));
settingsRouter.get('/users', authorize('ADMIN'), asyncHandler(settingsController.getUsers));

settingsRouter.post(
  '/users',
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.body = createUserSchema.parse(req.body);
    req.body.email = req.body.email.toLowerCase();
    next();
  }),
  asyncHandler(settingsController.createUser),
);

settingsRouter.patch(
  '/users/:userId/active',
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.body = updateUserStatusSchema.parse(req.body);
    next();
  }),
  asyncHandler(settingsController.updateUserActiveStatus),
);

settingsRouter.patch(
  '/users/:userId/password',
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.body = resetUserPasswordSchema.parse(req.body);
    next();
  }),
  asyncHandler(settingsController.resetUserPassword),
);

settingsRouter.get('/change-requests', authorize('ADMIN'), asyncHandler(settingsController.getChangeRequests));

settingsRouter.post(
  '/change-requests/:changeRequestId/approve',
  authorize('ADMIN'),
  asyncHandler(settingsController.approveChangeRequest),
);

settingsRouter.post(
  '/change-requests/:changeRequestId/reject',
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.body = rejectChangeRequestSchema.parse(req.body);
    next();
  }),
  asyncHandler(settingsController.rejectChangeRequest),
);

settingsRouter.get('/audit-logs', authorize('ADMIN'), asyncHandler(settingsController.getAuditLogs));
settingsRouter.get('/editing-mode', authorize('ADMIN'), asyncHandler(settingsController.getEditingMode));

settingsRouter.put(
  '/editing-mode',
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.body = editingModeSchema.parse(req.body);
    next();
  }),
  asyncHandler(settingsController.setEditingMode),
);
