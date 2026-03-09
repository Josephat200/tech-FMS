import { httpClient } from './httpClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type FinancialAlert = {
  alertId: string;
  alertType: 'OVERDUE_INVOICE' | 'BUDGET_OVERRUN' | 'CUSTOM';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType: string;
  entityId?: string;
  title: string;
  message: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: string;
};

export const alertApi = {
  listOpen: () => httpClient.get<ApiEnvelope<FinancialAlert[]>>('/accounting/alerts?status=OPEN&limit=50'),

  runScan: () =>
    httpClient.post<ApiEnvelope<{ generated: number }>, Record<string, never>>('/accounting/alerts/scan', {}),

  acknowledge: (alertId: string) =>
    httpClient.post<ApiEnvelope<{ alertId: string; status: string }>, Record<string, never>>(
      `/accounting/alerts/${alertId}/acknowledge`,
      {},
    ),
};
