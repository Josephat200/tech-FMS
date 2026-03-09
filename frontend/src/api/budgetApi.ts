import { httpClient } from './httpClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type BudgetCycle = {
  budgetCycleId: string;
  cycleName: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
};

export type DepartmentBudget = {
  departmentBudgetId: string;
  budgetCycleId: string;
  cycleName: string;
  departmentName: string;
  plannedAmount: number;
  approvedAmount: number;
  actualAmount: number;
  varianceAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
};

export const budgetApi = {
  listCycles: () => httpClient.get<ApiEnvelope<BudgetCycle[]>>('/accounting/budgets/cycles'),

  createCycle: (payload: {
    cycleName: string;
    fiscalYear: number;
    startDate: string;
    endDate: string;
  }) =>
    httpClient.post<ApiEnvelope<{ budgetCycleId: string; cycleName: string; status: string }>, typeof payload>(
      '/accounting/budgets/cycles',
      payload,
    ),

  listAllocations: (budgetCycleId?: string) =>
    httpClient.get<ApiEnvelope<DepartmentBudget[]>>(
      budgetCycleId ? `/accounting/budgets/allocations?budgetCycleId=${encodeURIComponent(budgetCycleId)}` : '/accounting/budgets/allocations',
    ),

  createAllocation: (payload: {
    budgetCycleId: string;
    departmentName: string;
    plannedAmount: number;
    notes?: string;
  }) =>
    httpClient.post<ApiEnvelope<{ departmentBudgetId: string; status: string }>, typeof payload>(
      '/accounting/budgets/allocations',
      payload,
    ),

  submitAllocation: (departmentBudgetId: string) =>
    httpClient.post<ApiEnvelope<{ departmentBudgetId: string; status: string }>, Record<string, never>>(
      `/accounting/budgets/allocations/${departmentBudgetId}/submit`,
      {},
    ),

  approveAllocation: (departmentBudgetId: string, approvedAmount?: number) =>
    httpClient.post<ApiEnvelope<{ departmentBudgetId: string; status: string }>, { approvedAmount?: number }>(
      `/accounting/budgets/allocations/${departmentBudgetId}/approve`,
      { approvedAmount },
    ),

  updateActual: (departmentBudgetId: string, actualAmount: number) =>
    httpClient.patch<ApiEnvelope<{ departmentBudgetId: string; actualAmount: number }>, { actualAmount: number }>(
      `/accounting/budgets/allocations/${departmentBudgetId}/actual`,
      { actualAmount },
    ),
};
