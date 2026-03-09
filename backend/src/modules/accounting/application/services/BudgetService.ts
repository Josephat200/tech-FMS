import { AppError } from '../../../../common/errors/AppError';
import { pgPool } from '../../../../infrastructure/db/postgres';

export class BudgetService {
  async createBudgetCycle(input: {
    cycleName: string;
    fiscalYear: number;
    startDate: string;
    endDate: string;
    createdByUserId?: string;
  }): Promise<{ budgetCycleId: string; cycleName: string; status: string }> {
    const result = await pgPool.query<{
      budget_cycle_id: string;
      cycle_name: string;
      status: string;
    }>(
      `
        INSERT INTO tech_rica.budget_cycles (
          cycle_name,
          fiscal_year,
          start_date,
          end_date,
          status,
          created_by
        )
        VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
        RETURNING budget_cycle_id, cycle_name, status
      `,
      [input.cycleName, input.fiscalYear, input.startDate, input.endDate, input.createdByUserId ?? null],
    );

    return {
      budgetCycleId: result.rows[0].budget_cycle_id,
      cycleName: result.rows[0].cycle_name,
      status: result.rows[0].status,
    };
  }

  async listBudgetCycles(): Promise<
    Array<{
      budgetCycleId: string;
      cycleName: string;
      fiscalYear: number;
      startDate: string;
      endDate: string;
      status: string;
    }>
  > {
    const result = await pgPool.query<{
      budget_cycle_id: string;
      cycle_name: string;
      fiscal_year: number;
      start_date: Date;
      end_date: Date;
      status: string;
    }>(
      `
        SELECT budget_cycle_id, cycle_name, fiscal_year, start_date, end_date, status
        FROM tech_rica.budget_cycles
        ORDER BY fiscal_year DESC, start_date DESC
      `,
    );

    return result.rows.map((row) => ({
      budgetCycleId: row.budget_cycle_id,
      cycleName: row.cycle_name,
      fiscalYear: row.fiscal_year,
      startDate: row.start_date.toISOString().slice(0, 10),
      endDate: row.end_date.toISOString().slice(0, 10),
      status: row.status,
    }));
  }

  async createDepartmentBudget(input: {
    budgetCycleId: string;
    departmentName: string;
    ownerUserId?: string;
    plannedAmount: number;
    notes?: string;
  }): Promise<{ departmentBudgetId: string; status: string }> {
    const result = await pgPool.query<{
      department_budget_id: string;
      status: string;
    }>(
      `
        INSERT INTO tech_rica.department_budgets (
          budget_cycle_id,
          department_name,
          owner_user_id,
          planned_amount,
          notes
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING department_budget_id, status
      `,
      [
        input.budgetCycleId,
        input.departmentName,
        input.ownerUserId ?? null,
        input.plannedAmount.toFixed(2),
        input.notes ?? null,
      ],
    );

    return {
      departmentBudgetId: result.rows[0].department_budget_id,
      status: result.rows[0].status,
    };
  }

  async submitDepartmentBudget(input: { departmentBudgetId: string }): Promise<{ departmentBudgetId: string; status: string }> {
    const result = await pgPool.query<{
      department_budget_id: string;
      status: string;
    }>(
      `
        UPDATE tech_rica.department_budgets
        SET status = 'SUBMITTED', submitted_at = now()
        WHERE department_budget_id = $1 AND status = 'DRAFT'
        RETURNING department_budget_id, status
      `,
      [input.departmentBudgetId],
    );

    if (!result.rowCount) {
      throw new AppError('Budget is not in draft state', 409, 'BUDGET_SUBMIT_CONFLICT');
    }

    return {
      departmentBudgetId: result.rows[0].department_budget_id,
      status: result.rows[0].status,
    };
  }

  async approveDepartmentBudget(input: {
    departmentBudgetId: string;
    approvedByUserId: string;
    approvedAmount?: number;
  }): Promise<{ departmentBudgetId: string; status: string }> {
    const amountToApply = input.approvedAmount;

    const result = await pgPool.query<{
      department_budget_id: string;
      status: string;
    }>(
      `
        UPDATE tech_rica.department_budgets
        SET
          status = 'APPROVED',
          approved_by = $2,
          approved_at = now(),
          approved_amount = COALESCE($3, planned_amount)
        WHERE department_budget_id = $1 AND status = 'SUBMITTED'
        RETURNING department_budget_id, status
      `,
      [input.departmentBudgetId, input.approvedByUserId, amountToApply?.toFixed(2) ?? null],
    );

    if (!result.rowCount) {
      throw new AppError('Budget is not in submitted state', 409, 'BUDGET_APPROVE_CONFLICT');
    }

    return {
      departmentBudgetId: result.rows[0].department_budget_id,
      status: result.rows[0].status,
    };
  }

  async updateActualAmount(input: {
    departmentBudgetId: string;
    actualAmount: number;
  }): Promise<{ departmentBudgetId: string; actualAmount: number }> {
    const result = await pgPool.query<{
      department_budget_id: string;
      actual_amount: string;
    }>(
      `
        UPDATE tech_rica.department_budgets
        SET actual_amount = $2, updated_at = now()
        WHERE department_budget_id = $1
        RETURNING department_budget_id, actual_amount
      `,
      [input.departmentBudgetId, input.actualAmount.toFixed(2)],
    );

    if (!result.rowCount) {
      throw new AppError('Budget allocation not found', 404, 'BUDGET_NOT_FOUND');
    }

    return {
      departmentBudgetId: result.rows[0].department_budget_id,
      actualAmount: Number(result.rows[0].actual_amount),
    };
  }

  async listDepartmentBudgets(input?: {
    budgetCycleId?: string;
  }): Promise<
    Array<{
      departmentBudgetId: string;
      budgetCycleId: string;
      cycleName: string;
      departmentName: string;
      plannedAmount: number;
      approvedAmount: number;
      actualAmount: number;
      varianceAmount: number;
      status: string;
    }>
  > {
    const values: string[] = [];
    let whereClause = '';

    if (input?.budgetCycleId) {
      values.push(input.budgetCycleId);
      whereClause = `WHERE db.budget_cycle_id = $1`;
    }

    const result = await pgPool.query<{
      department_budget_id: string;
      budget_cycle_id: string;
      cycle_name: string;
      department_name: string;
      planned_amount: string;
      approved_amount: string;
      actual_amount: string;
      status: string;
    }>(
      `
        SELECT
          db.department_budget_id,
          db.budget_cycle_id,
          bc.cycle_name,
          db.department_name,
          db.planned_amount,
          db.approved_amount,
          db.actual_amount,
          db.status
        FROM tech_rica.department_budgets db
        INNER JOIN tech_rica.budget_cycles bc ON bc.budget_cycle_id = db.budget_cycle_id
        ${whereClause}
        ORDER BY bc.fiscal_year DESC, db.department_name ASC
      `,
      values,
    );

    return result.rows.map((row) => {
      const approvedAmount = Number(row.approved_amount);
      const actualAmount = Number(row.actual_amount);

      return {
        departmentBudgetId: row.department_budget_id,
        budgetCycleId: row.budget_cycle_id,
        cycleName: row.cycle_name,
        departmentName: row.department_name,
        plannedAmount: Number(row.planned_amount),
        approvedAmount,
        actualAmount,
        varianceAmount: approvedAmount - actualAmount,
        status: row.status,
      };
    });
  }
}
