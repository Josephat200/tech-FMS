import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../../common/middlewares/async-handler';
import { authenticate } from '../../../../common/middlewares/authenticate';
import { authorize } from '../../../../common/middlewares/authorize';
import { TransactionService } from '../../application/services/TransactionService';
import { AccountingController } from '../controllers/AccountingController';
import { SettingsService } from '../../../settings/application/services/SettingsService';
import { InvoiceService } from '../../application/services/InvoiceService';
import { BudgetService } from '../../application/services/BudgetService';
import { AlertService } from '../../application/services/AlertService';

const lineSchema = z.object({
  accountId: z.string().uuid(),
  entryType: z.enum(['DEBIT', 'CREDIT']),
  amount: z.number().positive(),
  description: z.string().trim().max(500).optional(),
});

const createJournalEntrySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  referenceNo: z.string().trim().max(120).optional(),
  description: z.string().trim().min(1).max(500),
  transactionDate: z.string().date(),
  lines: z.array(lineSchema).min(2),
});

const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(3).max(60),
  invoiceType: z.enum(['AR', 'AP']),
  counterpartyName: z.string().trim().min(2).max(200),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  currencyCode: z.string().trim().length(3).optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(
    z.object({
      description: z.string().trim().min(1).max(500),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(),
    }),
  ).min(1),
});

const postInvoiceSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  referenceNo: z.string().trim().max(120).optional(),
  receivableOrExpenseAccountId: z.string().uuid(),
  revenueOrPayableAccountId: z.string().uuid(),
});

const createBudgetCycleSchema = z.object({
  cycleName: z.string().trim().min(2).max(100),
  fiscalYear: z.number().int().min(2000).max(9999),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

const createDepartmentBudgetSchema = z.object({
  budgetCycleId: z.string().uuid(),
  departmentName: z.string().trim().min(2).max(120),
  ownerUserId: z.string().uuid().optional(),
  plannedAmount: z.number().nonnegative(),
  notes: z.string().trim().max(1000).optional(),
});

const approveDepartmentBudgetSchema = z.object({
  approvedAmount: z.number().nonnegative().optional(),
});

const updateActualBudgetSchema = z.object({
  actualAmount: z.number().nonnegative(),
});

const transactionService = new TransactionService();
const invoiceService = new InvoiceService(transactionService);
const budgetService = new BudgetService();
const alertService = new AlertService();
const settingsService = new SettingsService(transactionService);
const accountingController = new AccountingController(
  transactionService,
  settingsService,
  invoiceService,
  budgetService,
  alertService,
);

export const accountingRouter = Router();

accountingRouter.post(
  '/journal-entries',
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER'),
  asyncHandler(async (req, _res, next) => {
    req.body = createJournalEntrySchema.parse(req.body);
    next();
  }),
  asyncHandler(accountingController.postJournalEntry),
);

accountingRouter.post(
  '/invoices',
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, _res, next) => {
    req.body = createInvoiceSchema.parse(req.body);
    next();
  }),
  asyncHandler(accountingController.createInvoice),
);

accountingRouter.get(
  '/invoices',
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR', 'DEPARTMENT_MANAGER'),
  asyncHandler(accountingController.listInvoices),
);

accountingRouter.post(
  '/invoices/:invoiceId/submit',
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'DEPARTMENT_MANAGER'),
  asyncHandler(accountingController.submitInvoice),
);

accountingRouter.post(
  '/invoices/:invoiceId/approve',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER'),
  asyncHandler(accountingController.approveInvoice),
);

accountingRouter.post(
  '/invoices/:invoiceId/post',
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER'),
  asyncHandler(async (req, _res, next) => {
    req.body = postInvoiceSchema.parse(req.body);
    next();
  }),
  asyncHandler(accountingController.postInvoiceToLedger),
);

accountingRouter.post(
  '/budgets/cycles',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER'),
  asyncHandler(async (req, _res, next) => {
    req.body = createBudgetCycleSchema.parse(req.body);
    next();
  }),
  asyncHandler(accountingController.createBudgetCycle),
);

accountingRouter.get(
  '/budgets/cycles',
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR', 'DEPARTMENT_MANAGER'),
  asyncHandler(accountingController.listBudgetCycles),
);

accountingRouter.post(
  '/budgets/allocations',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, _res, next) => {
    req.body = createDepartmentBudgetSchema.parse(req.body);
    next();
  }),
  asyncHandler(accountingController.createDepartmentBudget),
);

accountingRouter.get(
  '/budgets/allocations',
  authenticate,
  authorize('ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR', 'DEPARTMENT_MANAGER'),
  asyncHandler(accountingController.listDepartmentBudgets),
);

accountingRouter.post(
  '/budgets/allocations/:departmentBudgetId/submit',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER', 'DEPARTMENT_MANAGER'),
  asyncHandler(accountingController.submitDepartmentBudget),
);

accountingRouter.post(
  '/budgets/allocations/:departmentBudgetId/approve',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER'),
  asyncHandler(async (req, _res, next) => {
    req.body = approveDepartmentBudgetSchema.parse(req.body);
    next();
  }),
  asyncHandler(accountingController.approveDepartmentBudget),
);

accountingRouter.patch(
  '/budgets/allocations/:departmentBudgetId/actual',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'DEPARTMENT_MANAGER'),
  asyncHandler(async (req, _res, next) => {
    req.body = updateActualBudgetSchema.parse(req.body);
    next();
  }),
  asyncHandler(accountingController.updateDepartmentBudgetActual),
);

accountingRouter.post(
  '/alerts/scan',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER'),
  asyncHandler(accountingController.runAlertScan),
);

accountingRouter.get(
  '/alerts',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AUDITOR', 'DEPARTMENT_MANAGER'),
  asyncHandler(accountingController.listAlerts),
);

accountingRouter.post(
  '/alerts/:alertId/acknowledge',
  authenticate,
  authorize('ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'),
  asyncHandler(accountingController.acknowledgeAlert),
);
