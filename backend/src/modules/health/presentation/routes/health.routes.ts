import { Router } from 'express';
import { pgPool } from '../../../../infrastructure/db/postgres';
import { asyncHandler } from '../../../../common/middlewares/async-handler';
import { AiAssistantService } from '../../../assistant/application/services/AiAssistantService';

export const healthRouter = Router();
const assistantService = new AiAssistantService();

healthRouter.get(
  '/live',
  asyncHandler(async (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'florante-tech-fms-backend',
        status: 'alive',
        timestamp: new Date().toISOString(),
      },
    });
  }),
);

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const dbStartedAt = Date.now();
    await pgPool.query('SELECT 1');
    const dbLatencyMs = Date.now() - dbStartedAt;

    const assistant = await assistantService.getHealth();

    const readiness = {
      service: 'florante-tech-fms-backend',
      status: 'ready',
      database: {
        status: 'connected',
        latencyMs: dbLatencyMs,
      },
      assistant,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({ success: true, data: readiness });
  }),
);

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    await pgPool.query('SELECT 1');
    res.status(200).json({
      success: true,
      data: {
        service: 'florante-tech-fms-backend',
        status: 'up',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    });
  }),
);
