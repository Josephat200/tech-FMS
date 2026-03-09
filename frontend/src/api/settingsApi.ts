import { httpClient } from './httpClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type SystemUser = {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export type ChangeRequest = {
  changeRequestId: string;
  actionType: string;
  targetResource: string;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'FAILED';
  requestedAt: string;
  requestedBy: { userId: string; email: string };
  approvedBy?: { userId: string; email: string };
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  executedAt?: string;
};

export type AuditLog = {
  auditLogId: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorEmail?: string;
  createdAt: string;
  details?: unknown;
};

export const settingsApi = {
  getOverview: () =>
    httpClient.get<
      ApiEnvelope<{
        totalUsers: number;
        activeUsers: number;
        pendingApprovals: number;
        recentChanges: number;
      }>
    >('/settings/overview'),

  getUsers: () => httpClient.get<ApiEnvelope<SystemUser[]>>('/settings/users'),

  createUser: (payload: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'HR' | 'AUDITOR' | 'DEPARTMENT_MANAGER' | 'USER';
  }) => httpClient.post<ApiEnvelope<{ userId: string; email: string; role: string }>, typeof payload>('/settings/users', payload),

  updateUserStatus: (userId: string, isActive: boolean) =>
    httpClient.patch<ApiEnvelope<{ userId: string; isActive: boolean }>, { isActive: boolean }>(
      `/settings/users/${userId}/active`,
      { isActive },
    ),

  resetUserPassword: (userId: string, newPassword: string) =>
    httpClient.patch<ApiEnvelope<{ userId: string; email: string; passwordReset: true }>, { newPassword: string }>(
      `/settings/users/${userId}/password`,
      { newPassword },
    ),

  getChangeRequests: () =>
    httpClient.get<ApiEnvelope<ChangeRequest[]>>('/settings/change-requests?status=PENDING&limit=100'),

  approveChangeRequest: (changeRequestId: string) =>
    httpClient.post<ApiEnvelope<{ changeRequestId: string; status: string }>, Record<string, never>>(
      `/settings/change-requests/${changeRequestId}/approve`,
      {},
    ),

  rejectChangeRequest: (changeRequestId: string, reason: string) =>
    httpClient.post<ApiEnvelope<{ changeRequestId: string; status: string }>, { reason: string }>(
      `/settings/change-requests/${changeRequestId}/reject`,
      { reason },
    ),

  getAuditLogs: () => httpClient.get<ApiEnvelope<AuditLog[]>>('/settings/audit-logs?limit=200'),

  getEditingMode: () =>
    httpClient.get<ApiEnvelope<{ enabled: boolean; updatedAt?: string }>>('/settings/editing-mode'),

  setEditingMode: (enabled: boolean) =>
    httpClient.put<ApiEnvelope<{ enabled: boolean; updatedAt: string }>, { enabled: boolean }>(
      '/settings/editing-mode',
      { enabled },
    ),
};
