import { Request, Response } from 'express';
import { TransactionService } from '../../application/services/TransactionService';
import { SettingsService } from '../../../settings/application/services/SettingsService';
import { InvoiceService } from '../../application/services/InvoiceService';
import { BudgetService } from '../../application/services/BudgetService';
import { AlertService } from '../../application/services/AlertService';

export class AccountingController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly settingsService: SettingsService,
    private readonly invoiceService: InvoiceService,
    private readonly budgetService: BudgetService,
    private readonly alertService: AlertService,
  ) {}

  postJournalEntry = async (req: Request, res: Response): Promise<void> => {
    const isAdmin = req.user?.roles.includes('ADMIN') ?? false;

    if (!isAdmin) {
      const changeRequest = await this.settingsService.submitChangeRequest({
        actionType: 'POST_JOURNAL_ENTRY',
        targetResource: '/accounting/journal-entries',
        payload: req.body,
        requestedBy: req.user!.sub,
      });

      res.status(202).json({
        success: true,
        data: {
          message: 'Change request submitted for admin approval',
          ...changeRequest,
        },
      });
      return;
    }

    const result = await this.transactionService.postJournalEntry(req.body);

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'JOURNAL_ENTRY_POSTED',
      entityType: 'JOURNAL_ENTRY',
      entityId: result.journalEntryId,
      details: {
        totalDebit: result.totalDebit,
        totalCredit: result.totalCredit,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  createInvoice = async (req: Request, res: Response): Promise<void> => {
    const result = await this.invoiceService.createInvoice({
      ...req.body,
      createdByUserId: req.user?.sub,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: result.invoiceId,
      details: {
        invoiceNumber: result.invoiceNumber,
        totalAmount: result.totalAmount,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  };

  listInvoices = async (req: Request, res: Response): Promise<void> => {
    const result = await this.invoiceService.listInvoices({
      invoiceType: req.query.invoiceType as 'AR' | 'AP' | undefined,
      status: req.query.status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID' | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  };

  submitInvoice = async (req: Request, res: Response): Promise<void> => {
    const result = await this.invoiceService.submitInvoice({
      invoiceId: req.params.invoiceId,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'INVOICE_SUBMITTED',
      entityType: 'INVOICE',
      entityId: result.invoiceId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };

  approveInvoice = async (req: Request, res: Response): Promise<void> => {
    const result = await this.invoiceService.approveInvoice({
      invoiceId: req.params.invoiceId,
      approvedByUserId: req.user!.sub,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'INVOICE_APPROVED',
      entityType: 'INVOICE',
      entityId: result.invoiceId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };

  postInvoiceToLedger = async (req: Request, res: Response): Promise<void> => {
    const result = await this.invoiceService.postInvoiceToLedger({
      invoiceId: req.params.invoiceId,
      postedByUserId: req.user!.sub,
      ...req.body,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'INVOICE_POSTED_TO_LEDGER',
      entityType: 'INVOICE',
      entityId: result.invoiceId,
      details: {
        journalEntryId: result.journalEntryId,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };

  createBudgetCycle = async (req: Request, res: Response): Promise<void> => {
    const result = await this.budgetService.createBudgetCycle({
      ...req.body,
      createdByUserId: req.user?.sub,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'BUDGET_CYCLE_CREATED',
      entityType: 'BUDGET_CYCLE',
      entityId: result.budgetCycleId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(201).json({ success: true, data: result });
  };

  listBudgetCycles = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.budgetService.listBudgetCycles();
    res.status(200).json({ success: true, data: result });
  };

  createDepartmentBudget = async (req: Request, res: Response): Promise<void> => {
    const result = await this.budgetService.createDepartmentBudget(req.body);

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'DEPARTMENT_BUDGET_CREATED',
      entityType: 'DEPARTMENT_BUDGET',
      entityId: result.departmentBudgetId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(201).json({ success: true, data: result });
  };

  listDepartmentBudgets = async (req: Request, res: Response): Promise<void> => {
    const result = await this.budgetService.listDepartmentBudgets({
      budgetCycleId: req.query.budgetCycleId as string | undefined,
    });
    res.status(200).json({ success: true, data: result });
  };

  submitDepartmentBudget = async (req: Request, res: Response): Promise<void> => {
    const result = await this.budgetService.submitDepartmentBudget({
      departmentBudgetId: req.params.departmentBudgetId,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'DEPARTMENT_BUDGET_SUBMITTED',
      entityType: 'DEPARTMENT_BUDGET',
      entityId: result.departmentBudgetId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };

  approveDepartmentBudget = async (req: Request, res: Response): Promise<void> => {
    const result = await this.budgetService.approveDepartmentBudget({
      departmentBudgetId: req.params.departmentBudgetId,
      approvedByUserId: req.user!.sub,
      approvedAmount: req.body.approvedAmount,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'DEPARTMENT_BUDGET_APPROVED',
      entityType: 'DEPARTMENT_BUDGET',
      entityId: result.departmentBudgetId,
      details: {
        approvedAmount: req.body.approvedAmount,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };

  updateDepartmentBudgetActual = async (req: Request, res: Response): Promise<void> => {
    const result = await this.budgetService.updateActualAmount({
      departmentBudgetId: req.params.departmentBudgetId,
      actualAmount: req.body.actualAmount,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'DEPARTMENT_BUDGET_ACTUAL_UPDATED',
      entityType: 'DEPARTMENT_BUDGET',
      entityId: result.departmentBudgetId,
      details: {
        actualAmount: result.actualAmount,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };

  runAlertScan = async (req: Request, res: Response): Promise<void> => {
    const result = await this.alertService.runFinancialScan();

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'ALERT_SCAN_EXECUTED',
      entityType: 'FINANCIAL_ALERT',
      details: result,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };

  listAlerts = async (req: Request, res: Response): Promise<void> => {
    const status = (req.query.status as string | undefined) ?? 'OPEN';
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const result = await this.alertService.listAlerts(status, limit);
    res.status(200).json({ success: true, data: result });
  };

  acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
    const result = await this.alertService.acknowledgeAlert({
      alertId: req.params.alertId,
      acknowledgedByUserId: req.user!.sub,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'ALERT_ACKNOWLEDGED',
      entityType: 'FINANCIAL_ALERT',
      entityId: result.alertId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(200).json({ success: true, data: result });
  };
}
