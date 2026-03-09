import { pgPool } from '../../../../infrastructure/db/postgres';
import { AppError } from '../../../../common/errors/AppError';

export class AlertService {
  async runFinancialScan(): Promise<{ generated: number }> {
    let generated = 0;

    const overdueInvoices = await pgPool.query<{
      invoice_id: string;
      invoice_number: string;
      due_date: Date;
      total_amount: string;
    }>(
      `
        SELECT invoice_id, invoice_number, due_date, total_amount
        FROM tech_rica.invoices
        WHERE due_date < CURRENT_DATE
          AND status IN ('SUBMITTED', 'APPROVED', 'POSTED')
      `,
    );

    for (const invoice of overdueInvoices.rows) {
      const inserted = await this.insertAlertIfNotOpen({
        alertType: 'OVERDUE_INVOICE',
        severity: 'HIGH',
        entityType: 'INVOICE',
        entityId: invoice.invoice_id,
        title: `Overdue invoice ${invoice.invoice_number}`,
        message: `Invoice ${invoice.invoice_number} is overdue since ${invoice.due_date.toISOString().slice(0, 10)} for ${Number(invoice.total_amount).toLocaleString()} total amount.`,
        metadata: {
          invoiceNumber: invoice.invoice_number,
          dueDate: invoice.due_date.toISOString(),
          totalAmount: Number(invoice.total_amount),
        },
      });
      if (inserted) {
        generated += 1;
      }
    }

    const budgetOverruns = await pgPool.query<{
      department_budget_id: string;
      department_name: string;
      approved_amount: string;
      actual_amount: string;
    }>(
      `
        SELECT department_budget_id, department_name, approved_amount, actual_amount
        FROM tech_rica.department_budgets
        WHERE status = 'APPROVED'
          AND actual_amount > approved_amount
      `,
    );

    for (const budget of budgetOverruns.rows) {
      const inserted = await this.insertAlertIfNotOpen({
        alertType: 'BUDGET_OVERRUN',
        severity: 'CRITICAL',
        entityType: 'DEPARTMENT_BUDGET',
        entityId: budget.department_budget_id,
        title: `Budget overrun: ${budget.department_name}`,
        message: `${budget.department_name} exceeded budget by ${(Number(budget.actual_amount) - Number(budget.approved_amount)).toLocaleString()}.`,
        metadata: {
          departmentName: budget.department_name,
          approvedAmount: Number(budget.approved_amount),
          actualAmount: Number(budget.actual_amount),
        },
      });
      if (inserted) {
        generated += 1;
      }
    }

    return { generated };
  }

  async listAlerts(status = 'OPEN', limit = 100): Promise<
    Array<{
      alertId: string;
      alertType: string;
      severity: string;
      entityType: string;
      entityId?: string;
      title: string;
      message: string;
      status: string;
      createdAt: string;
      metadata?: unknown;
    }>
  > {
    const result = await pgPool.query<{
      alert_id: string;
      alert_type: string;
      severity: string;
      entity_type: string;
      entity_id: string | null;
      title: string;
      message: string;
      status: string;
      created_at: Date;
      metadata: unknown;
    }>(
      `
        SELECT alert_id, alert_type, severity, entity_type, entity_id, title, message, status, created_at, metadata
        FROM tech_rica.financial_alerts
        WHERE status = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [status.toUpperCase(), limit],
    );

    return result.rows.map((row) => ({
      alertId: row.alert_id,
      alertType: row.alert_type,
      severity: row.severity,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      title: row.title,
      message: row.message,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      metadata: row.metadata ?? undefined,
    }));
  }

  async acknowledgeAlert(input: {
    alertId: string;
    acknowledgedByUserId: string;
  }): Promise<{ alertId: string; status: string }> {
    const result = await pgPool.query<{ alert_id: string; status: string }>(
      `
        UPDATE tech_rica.financial_alerts
        SET status = 'ACKNOWLEDGED', acknowledged_at = now(), acknowledged_by = $2
        WHERE alert_id = $1 AND status = 'OPEN'
        RETURNING alert_id, status
      `,
      [input.alertId, input.acknowledgedByUserId],
    );

    if (!result.rowCount) {
      throw new AppError('Alert not found or no longer open', 404, 'ALERT_NOT_FOUND');
    }

    return {
      alertId: result.rows[0].alert_id,
      status: result.rows[0].status,
    };
  }

  private async insertAlertIfNotOpen(input: {
    alertType: 'OVERDUE_INVOICE' | 'BUDGET_OVERRUN' | 'CUSTOM';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    entityType: string;
    entityId?: string;
    title: string;
    message: string;
    metadata?: unknown;
  }): Promise<boolean> {
    const result = await pgPool.query(
      `
        INSERT INTO tech_rica.financial_alerts (
          alert_type,
          severity,
          entity_type,
          entity_id,
          title,
          message,
          metadata,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'OPEN')
        ON CONFLICT DO NOTHING
      `,
      [
        input.alertType,
        input.severity,
        input.entityType,
        input.entityId ?? null,
        input.title,
        input.message,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
