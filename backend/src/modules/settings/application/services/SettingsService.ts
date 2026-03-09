import { AppError } from '../../../../common/errors/AppError';
import { pgPool } from '../../../../infrastructure/db/postgres';
import { hashPassword } from '../../../../infrastructure/security/hash';
import { TransactionService } from '../../../accounting/application/services/TransactionService';

export type CreateUserInput = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'HR' | 'AUDITOR' | 'DEPARTMENT_MANAGER' | 'USER';
};

export type SubmitChangeRequestInput = {
  actionType: 'POST_JOURNAL_ENTRY';
  targetResource: string;
  payload: unknown;
  requestedBy: string;
};

export type RecordAuditLogInput = {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string;
  userAgent?: string;
};

export class SettingsService {
  constructor(private readonly transactionService: TransactionService) {}

  async listUsers(): Promise<
    Array<{
      userId: string;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
      roles: string[];
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const result = await pgPool.query<{
      user_id: string;
      username: string;
      email: string;
      first_name: string;
      last_name: string;
      is_active: boolean;
      roles: string[];
      created_at: Date;
      updated_at: Date;
    }>(`
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles,
        u.created_at,
        u.updated_at
      FROM tech_rica.users u
      LEFT JOIN tech_rica.user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN tech_rica.roles r ON r.role_id = ur.role_id
      GROUP BY u.user_id, u.username, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.updated_at
      ORDER BY u.created_at DESC
    `);

    return result.rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      isActive: row.is_active,
      roles: row.roles,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  async setUserActiveStatus(input: {
    userId: string;
    isActive: boolean;
    actorUserId: string;
  }): Promise<{ userId: string; isActive: boolean }> {
    const result = await pgPool.query<{ user_id: string; is_active: boolean }>(
      `
        UPDATE tech_rica.users
        SET is_active = $2
        WHERE user_id = $1
        RETURNING user_id, is_active
      `,
      [input.userId, input.isActive],
    );

    if (!result.rowCount) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await this.recordAuditLog({
      actorUserId: input.actorUserId,
      action: input.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: input.userId,
      details: { isActive: input.isActive },
    });

    return {
      userId: result.rows[0].user_id,
      isActive: result.rows[0].is_active,
    };
  }

  async resetUserPassword(input: {
    targetUserId: string;
    newPassword: string;
    actorUserId: string;
  }): Promise<{ userId: string; email: string; passwordReset: true }> {
    if (input.targetUserId === input.actorUserId) {
      throw new AppError('Use profile self-service flow to change your own password', 400, 'SELF_PASSWORD_RESET_NOT_ALLOWED');
    }

    const passwordHash = await hashPassword(input.newPassword);

    const result = await pgPool.query<{ user_id: string; email: string }>(
      `
        UPDATE tech_rica.users
        SET password_hash = $2, updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, email
      `,
      [input.targetUserId, passwordHash],
    );

    if (!result.rowCount) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await pgPool.query(
      `
        UPDATE tech_rica.refresh_tokens
        SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL
      `,
      [input.targetUserId],
    );

    await this.recordAuditLog({
      actorUserId: input.actorUserId,
      action: 'USER_PASSWORD_RESET',
      entityType: 'USER',
      entityId: input.targetUserId,
      details: {
        email: result.rows[0].email,
      },
    });

    return {
      userId: result.rows[0].user_id,
      email: result.rows[0].email,
      passwordReset: true,
    };
  }

  async getOverview(): Promise<{
    totalUsers: number;
    activeUsers: number;
    pendingApprovals: number;
    recentChanges: number;
  }> {
    const result = await pgPool.query<{
      total_users: string;
      active_users: string;
      pending_approvals: string;
      recent_changes: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM tech_rica.users) AS total_users,
        (SELECT COUNT(*)::text FROM tech_rica.users WHERE is_active = TRUE) AS active_users,
        (SELECT COUNT(*)::text FROM tech_rica.change_requests WHERE status = 'PENDING') AS pending_approvals,
        (
          SELECT COUNT(*)::text
          FROM tech_rica.audit_logs
          WHERE created_at >= now() - INTERVAL '24 hours'
        ) AS recent_changes
    `);

    const row = result.rows[0];
    return {
      totalUsers: Number(row.total_users),
      activeUsers: Number(row.active_users),
      pendingApprovals: Number(row.pending_approvals),
      recentChanges: Number(row.recent_changes),
    };
  }

  async submitChangeRequest(
    input: SubmitChangeRequestInput,
  ): Promise<{ changeRequestId: string; status: string; requestedAt: string }> {
    const result = await pgPool.query<{
      change_request_id: string;
      status: string;
      requested_at: Date;
    }>(
      `
        INSERT INTO tech_rica.change_requests (
          action_type,
          target_resource,
          payload,
          status,
          requested_by
        )
        VALUES ($1, $2, $3::jsonb, 'PENDING', $4)
        RETURNING change_request_id, status, requested_at
      `,
      [input.actionType, input.targetResource, JSON.stringify(input.payload), input.requestedBy],
    );

    await this.recordAuditLog({
      actorUserId: input.requestedBy,
      action: 'CHANGE_REQUEST_SUBMITTED',
      entityType: 'CHANGE_REQUEST',
      entityId: result.rows[0].change_request_id,
      details: {
        actionType: input.actionType,
        targetResource: input.targetResource,
      },
    });

    return {
      changeRequestId: result.rows[0].change_request_id,
      status: result.rows[0].status,
      requestedAt: result.rows[0].requested_at.toISOString(),
    };
  }

  async listChangeRequests(status?: string, limit = 50): Promise<
    Array<{
      changeRequestId: string;
      actionType: string;
      targetResource: string;
      status: string;
      requestedAt: string;
      requestedBy: { userId: string; email: string };
      approvedBy?: { userId: string; email: string };
      approvedAt?: string;
      rejectedAt?: string;
      rejectionReason?: string;
      executedAt?: string;
    }>
  > {
    const values: Array<string | number> = [];
    let whereClause = '';

    if (status) {
      values.push(status.toUpperCase());
      whereClause = `WHERE cr.status = $${values.length}`;
    }

    values.push(limit);

    const query = `
      SELECT
        cr.change_request_id,
        cr.action_type,
        cr.target_resource,
        cr.status,
        cr.requested_at,
        cr.approved_at,
        cr.rejected_at,
        cr.rejection_reason,
        cr.executed_at,
        req.user_id AS requested_by_user_id,
        req.email AS requested_by_email,
        appr.user_id AS approved_by_user_id,
        appr.email AS approved_by_email
      FROM tech_rica.change_requests cr
      INNER JOIN tech_rica.users req ON req.user_id = cr.requested_by
      LEFT JOIN tech_rica.users appr ON appr.user_id = cr.approved_by
      ${whereClause}
      ORDER BY cr.requested_at DESC
      LIMIT $${values.length}
    `;

    const result = await pgPool.query<{
      change_request_id: string;
      action_type: string;
      target_resource: string;
      status: string;
      requested_at: Date;
      approved_at: Date | null;
      rejected_at: Date | null;
      rejection_reason: string | null;
      executed_at: Date | null;
      requested_by_user_id: string;
      requested_by_email: string;
      approved_by_user_id: string | null;
      approved_by_email: string | null;
    }>(query, values);

    return result.rows.map((row) => ({
      changeRequestId: row.change_request_id,
      actionType: row.action_type,
      targetResource: row.target_resource,
      status: row.status,
      requestedAt: row.requested_at.toISOString(),
      requestedBy: {
        userId: row.requested_by_user_id,
        email: row.requested_by_email,
      },
      approvedBy:
        row.approved_by_user_id && row.approved_by_email
          ? {
              userId: row.approved_by_user_id,
              email: row.approved_by_email,
            }
          : undefined,
      approvedAt: row.approved_at?.toISOString(),
      rejectedAt: row.rejected_at?.toISOString(),
      rejectionReason: row.rejection_reason ?? undefined,
      executedAt: row.executed_at?.toISOString(),
    }));
  }

  async approveChangeRequest(input: {
    changeRequestId: string;
    approvedByUserId: string;
  }): Promise<{ changeRequestId: string; status: string; executionResult: unknown }> {
    const processing = await pgPool.query<{
      change_request_id: string;
      action_type: string;
      payload: unknown;
    }>(
      `
        UPDATE tech_rica.change_requests
        SET status = 'PROCESSING'
        WHERE change_request_id = $1 AND status = 'PENDING'
        RETURNING change_request_id, action_type, payload
      `,
      [input.changeRequestId],
    );

    if (!processing.rowCount) {
      throw new AppError('Change request not found or already processed', 404, 'CHANGE_REQUEST_NOT_FOUND');
    }

    const row = processing.rows[0];

    try {
      let executionResult: unknown = null;

      if (row.action_type === 'POST_JOURNAL_ENTRY') {
        executionResult = await this.transactionService.postJournalEntry(row.payload as never);
      } else {
        throw new AppError('Unsupported change request action', 400, 'UNSUPPORTED_CHANGE_ACTION');
      }

      await pgPool.query(
        `
          UPDATE tech_rica.change_requests
          SET
            status = 'APPROVED',
            approved_by = $2,
            approved_at = now(),
            execution_result = $3::jsonb,
            executed_at = now()
          WHERE change_request_id = $1
        `,
        [input.changeRequestId, input.approvedByUserId, JSON.stringify(executionResult)],
      );

      await this.recordAuditLog({
        actorUserId: input.approvedByUserId,
        action: 'CHANGE_REQUEST_APPROVED',
        entityType: 'CHANGE_REQUEST',
        entityId: input.changeRequestId,
        details: { actionType: row.action_type },
      });

      return {
        changeRequestId: input.changeRequestId,
        status: 'APPROVED',
        executionResult,
      };
    } catch (error) {
      await pgPool.query(
        `
          UPDATE tech_rica.change_requests
          SET
            status = 'FAILED',
            approved_by = $2,
            approved_at = now(),
            failure_reason = $3
          WHERE change_request_id = $1
        `,
        [
          input.changeRequestId,
          input.approvedByUserId,
          error instanceof Error ? error.message : 'Unknown processing error',
        ],
      );

      throw error;
    }
  }

  async rejectChangeRequest(input: {
    changeRequestId: string;
    rejectedByUserId: string;
    reason: string;
  }): Promise<{ changeRequestId: string; status: string }> {
    const result = await pgPool.query(
      `
        UPDATE tech_rica.change_requests
        SET
          status = 'REJECTED',
          rejected_by = $2,
          rejected_at = now(),
          rejection_reason = $3
        WHERE change_request_id = $1 AND status = 'PENDING'
        RETURNING change_request_id
      `,
      [input.changeRequestId, input.rejectedByUserId, input.reason],
    );

    if (!result.rowCount) {
      throw new AppError('Change request not found or already processed', 404, 'CHANGE_REQUEST_NOT_FOUND');
    }

    await this.recordAuditLog({
      actorUserId: input.rejectedByUserId,
      action: 'CHANGE_REQUEST_REJECTED',
      entityType: 'CHANGE_REQUEST',
      entityId: input.changeRequestId,
      details: { reason: input.reason },
    });

    return {
      changeRequestId: input.changeRequestId,
      status: 'REJECTED',
    };
  }

  async listAuditLogs(limit = 100): Promise<
    Array<{
      auditLogId: string;
      action: string;
      entityType: string;
      entityId?: string;
      actorEmail?: string;
      createdAt: string;
      details?: unknown;
    }>
  > {
    const result = await pgPool.query<{
      audit_log_id: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: Date;
      details: unknown;
      actor_email: string | null;
    }>(
      `
        SELECT
          al.audit_log_id,
          al.action,
          al.entity_type,
          al.entity_id,
          al.created_at,
          al.details,
          u.email AS actor_email
        FROM tech_rica.audit_logs al
        LEFT JOIN tech_rica.users u ON u.user_id = al.actor_user_id
        ORDER BY al.created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      auditLogId: row.audit_log_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      actorEmail: row.actor_email ?? undefined,
      createdAt: row.created_at.toISOString(),
      details: row.details ?? undefined,
    }));
  }

  async getAdminEditingMode(): Promise<{ enabled: boolean; updatedAt?: string }> {
    const result = await pgPool.query<{ setting_value: { enabled?: boolean }; updated_at: Date }>(
      `
        SELECT setting_value, updated_at
        FROM tech_rica.system_settings
        WHERE setting_key = 'ADMIN_EDITING_MODE'
        LIMIT 1
      `,
    );

    if (!result.rowCount) {
      return { enabled: false };
    }

    const row = result.rows[0];
    return {
      enabled: Boolean(row.setting_value?.enabled),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async setAdminEditingMode(input: {
    enabled: boolean;
    updatedByUserId: string;
  }): Promise<{ enabled: boolean; updatedAt: string }> {
    const result = await pgPool.query<{ updated_at: Date }>(
      `
        INSERT INTO tech_rica.system_settings(setting_key, setting_value, updated_by, updated_at)
        VALUES ('ADMIN_EDITING_MODE', jsonb_build_object('enabled', $1), $2, now())
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = now()
        RETURNING updated_at
      `,
      [input.enabled, input.updatedByUserId],
    );

    await this.recordAuditLog({
      actorUserId: input.updatedByUserId,
      action: input.enabled ? 'ADMIN_EDITING_MODE_ENABLED' : 'ADMIN_EDITING_MODE_DISABLED',
      entityType: 'SYSTEM_SETTING',
      entityId: 'ADMIN_EDITING_MODE',
      details: { enabled: input.enabled },
    });

    return {
      enabled: input.enabled,
      updatedAt: result.rows[0].updated_at.toISOString(),
    };
  }

  async recordAuditLog(input: RecordAuditLogInput): Promise<void> {
    await pgPool.query(
      `
        INSERT INTO tech_rica.audit_logs (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          details,
          ip_address,
          user_agent
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `,
      [
        input.actorUserId ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.details ? JSON.stringify(input.details) : null,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );
  }
}
