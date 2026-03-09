import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../../common/middlewares/async-handler';
import { authenticate } from '../../../../common/middlewares/authenticate';
import { authorize } from '../../../../common/middlewares/authorize';
import { AiAssistantService } from '../../application/services/AiAssistantService';
import { AssistantController } from '../controllers/AssistantController';

const askSchema = z.object({
  prompt: z.string().trim().min(2).max(1000),
  route: z.string().trim().max(200).optional(),
});

const assistantConfigSchema = z.object({
  systemPrompt: z.string().trim().min(20).max(4000),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().min(64).max(2000),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const metricsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

const service = new AiAssistantService();
const controller = new AssistantController(service);

export const assistantRouter = Router();

assistantRouter.use(authenticate);
assistantRouter.use(limiter);

assistantRouter.post(
  '/ask',
  asyncHandler(async (req, _res, next) => {
    req.body = askSchema.parse(req.body);
    next();
  }),
  asyncHandler(controller.ask),
);

assistantRouter.get(
  '/history',
  asyncHandler(async (req, _res, next) => {
    req.query = historyQuerySchema.parse(req.query) as never;
    next();
  }),
  asyncHandler(controller.history),
);

assistantRouter.get('/config', authorize('ADMIN'), asyncHandler(controller.getConfig));

assistantRouter.get('/health', authorize('ADMIN'), asyncHandler(controller.health));

assistantRouter.put(
  '/config',
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.body = assistantConfigSchema.parse(req.body);
    next();
  }),
  asyncHandler(controller.updateConfig),
);

assistantRouter.get(
  '/metrics',
  authorize('ADMIN'),
  asyncHandler(async (req, _res, next) => {
    req.query = metricsQuerySchema.parse(req.query) as never;
    next();
  }),
  asyncHandler(controller.metrics),
);
