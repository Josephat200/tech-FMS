import { Router } from 'express';
import { authRouter } from '../../modules/auth/presentation/routes/auth.routes';
import { healthRouter } from '../../modules/health/presentation/routes/health.routes';
import { accountingRouter } from '../../modules/accounting/presentation/routes/accounting.routes';
import { reportsRouter } from '../../modules/reports/presentation/routes/reports.routes';
import { settingsRouter } from '../../modules/settings/presentation/routes/settings.routes';
import { assistantRouter } from '../../modules/assistant/presentation/routes/assistant.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/accounting', accountingRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/assistant', assistantRouter);
