import { httpClient } from './httpClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type InvoiceRecord = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: 'AR' | 'AP';
  counterpartyName: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID';
  createdAt: string;
};

export const invoiceApi = {
  list: () =>
    httpClient.get<
      ApiEnvelope<{
        invoices: InvoiceRecord[];
        arAging: Array<{ label: string; value: number }>;
      }>
    >('/accounting/invoices'),

  create: (payload: {
    invoiceNumber: string;
    invoiceType: 'AR' | 'AP';
    counterpartyName: string;
    issueDate: string;
    dueDate: string;
    notes?: string;
    lines: Array<{ description: string; quantity: number; unitPrice: number }>;
  }) =>
    httpClient.post<ApiEnvelope<{ invoiceId: string; invoiceNumber: string; status: string; totalAmount: number }>, typeof payload>(
      '/accounting/invoices',
      payload,
    ),

  submit: (invoiceId: string) =>
    httpClient.post<ApiEnvelope<{ invoiceId: string; status: string }>, Record<string, never>>(
      `/accounting/invoices/${invoiceId}/submit`,
      {},
    ),

  approve: (invoiceId: string) =>
    httpClient.post<ApiEnvelope<{ invoiceId: string; status: string }>, Record<string, never>>(
      `/accounting/invoices/${invoiceId}/approve`,
      {},
    ),

  postToLedger: (
    invoiceId: string,
    payload: { receivableOrExpenseAccountId: string; revenueOrPayableAccountId: string; idempotencyKey?: string },
  ) =>
    httpClient.post<ApiEnvelope<{ invoiceId: string; status: string; journalEntryId: string }>, typeof payload>(
      `/accounting/invoices/${invoiceId}/post`,
      payload,
    ),
};
