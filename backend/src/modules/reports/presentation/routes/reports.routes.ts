import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../../common/middlewares/async-handler';
import { authenticate } from '../../../../common/middlewares/authenticate';
import { authorize } from '../../../../common/middlewares/authorize';
import { FinancialReportService } from '../../application/services/FinancialReportService';
import { ReportsController } from '../controllers/ReportsController';

const asOfSchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const reportService = new FinancialReportService();
const reportsController = new ReportsController(reportService);

export const reportsRouter = Router();

reportsRouter.use(
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR', 'DEPARTMENT_MANAGER'),
);

reportsRouter.get(
  '/trial-balance',
  asyncHandler(async (req, _res, next) => {
    req.query = asOfSchema.parse(req.query);
    next();
  }),
  asyncHandler(reportsController.getTrialBalance),
);

reportsRouter.get(
  '/income-statement',
  asyncHandler(async (req, _res, next) => {
    req.query = rangeSchema.parse(req.query);
    next();
  }),
  asyncHandler(reportsController.getIncomeStatement),
);

reportsRouter.get(
  '/balance-sheet',
  asyncHandler(async (req, _res, next) => {
    req.query = asOfSchema.parse(req.query);
    next();
  }),
  asyncHandler(reportsController.getBalanceSheet),
);

reportsRouter.get(
  '/cash-flow',
  asyncHandler(async (req, _res, next) => {
    req.query = rangeSchema.parse(req.query);
    next();
  }),
  asyncHandler(reportsController.getCashFlowStatement),
);
