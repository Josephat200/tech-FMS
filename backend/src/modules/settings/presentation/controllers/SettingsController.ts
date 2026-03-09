import { Request, Response } from 'express';
import { AdminProvisionUserUseCase } from '../../../auth/application/use-cases/AdminProvisionUserUseCase';
import { SettingsService } from '../../application/services/SettingsService';

export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly adminProvisionUserUseCase: AdminProvisionUserUseCase,
  ) {}

  getOverview = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.settingsService.getOverview();
    res.status(200).json({ success: true, data });
  };

  getUsers = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.settingsService.listUsers();
    res.status(200).json({ success: true, data });
  };

  createUser = async (req: Request, res: Response): Promise<void> => {
    const { username, email, firstName, lastName, role } = req.body as {
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'HR' | 'AUDITOR' | 'DEPARTMENT_MANAGER' | 'USER';
    };

    const result = await this.adminProvisionUserUseCase.execute({
      username,
      email,
      firstName,
      lastName,
      role,
    });

    await this.settingsService.recordAuditLog({
      actorUserId: req.user?.sub,
      action: 'USER_PROVISIONED',
      entityType: 'USER',
      entityId: result.userId,
      details: {
        email: result.email,
        role: result.role,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(201).json({ success: true, data: result });
  };

  updateUserActiveStatus = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    const data = await this.settingsService.setUserActiveStatus({
      userId,
      isActive,
      actorUserId: req.user!.sub,
    });

    res.status(200).json({ success: true, data });
  };

  resetUserPassword = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { newPassword } = req.body as { newPassword: string };

    const data = await this.settingsService.resetUserPassword({
      targetUserId: userId,
      newPassword,
      actorUserId: req.user!.sub,
    });

    res.status(200).json({ success: true, data });
  };

  submitChangeRequest = async (req: Request, res: Response): Promise<void> => {
    const { actionType, targetResource, payload } = req.body as {
      actionType: 'POST_JOURNAL_ENTRY';
      targetResource: string;
      payload: unknown;
    };

    const data = await this.settingsService.submitChangeRequest({
      actionType,
      targetResource,
      payload,
      requestedBy: req.user!.sub,
    });

    res.status(202).json({
      success: true,
      data,
    });
  };

  getChangeRequests = async (req: Request, res: Response): Promise<void> => {
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit ?? 50);
    const data = await this.settingsService.listChangeRequests(status, limit);
    res.status(200).json({ success: true, data });
  };

  approveChangeRequest = async (req: Request, res: Response): Promise<void> => {
    const data = await this.settingsService.approveChangeRequest({
      changeRequestId: req.params.changeRequestId,
      approvedByUserId: req.user!.sub,
    });

    res.status(200).json({ success: true, data });
  };

  rejectChangeRequest = async (req: Request, res: Response): Promise<void> => {
    const { reason } = req.body as { reason: string };
    const data = await this.settingsService.rejectChangeRequest({
      changeRequestId: req.params.changeRequestId,
      rejectedByUserId: req.user!.sub,
      reason,
    });

    res.status(200).json({ success: true, data });
  };

  getAuditLogs = async (req: Request, res: Response): Promise<void> => {
    const limit = Number(req.query.limit ?? 100);
    const data = await this.settingsService.listAuditLogs(limit);
    res.status(200).json({ success: true, data });
  };

  getEditingMode = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.settingsService.getAdminEditingMode();
    res.status(200).json({ success: true, data });
  };

  setEditingMode = async (req: Request, res: Response): Promise<void> => {
    const { enabled } = req.body as { enabled: boolean };
    const data = await this.settingsService.setAdminEditingMode({
      enabled,
      updatedByUserId: req.user!.sub,
    });

    res.status(200).json({ success: true, data });
  };
}
