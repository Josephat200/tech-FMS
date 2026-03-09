import { AppError } from '../../../../common/errors/AppError';
import { pgPool } from '../../../../infrastructure/db/postgres';
import { TransactionService } from './TransactionService';

type InvoiceLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export class InvoiceService {
  constructor(private readonly transactionService: TransactionService) {}

  async createInvoice(input: {
    invoiceNumber: string;
    invoiceType: 'AR' | 'AP';
    counterpartyName: string;
    issueDate: string;
    dueDate: string;
    currencyCode?: string;
    notes?: string;
    lines: InvoiceLineInput[];
    createdByUserId?: string;
  }): Promise<{ invoiceId: string; invoiceNumber: string; status: string; totalAmount: number }> {
    if (!input.lines.length) {
      throw new AppError('Invoice requires at least one line', 400, 'INVOICE_LINES_REQUIRED');
    }

    const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const taxAmount = 0;
    const totalAmount = subtotal + taxAmount;

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const invoiceResult = await client.query<{
        invoice_id: string;
        invoice_number: string;
        status: string;
        total_amount: string;
      }>(
        `
          INSERT INTO tech_rica.invoices (
            invoice_number,
            invoice_type,
            counterparty_name,
            issue_date,
            due_date,
            currency_code,
            subtotal_amount,
            tax_amount,
            total_amount,
            notes,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)
          RETURNING invoice_id, invoice_number, status, total_amount
        `,
        [
          input.invoiceNumber,
          input.invoiceType,
          input.counterpartyName,
          input.issueDate,
          input.dueDate,
          (input.currencyCode ?? 'USD').toUpperCase(),
          subtotal.toFixed(2),
          totalAmount.toFixed(2),
          input.notes ?? null,
          input.createdByUserId ?? null,
        ],
      );

      const invoice = invoiceResult.rows[0];

      const lineNumbers: number[] = [];
      const descriptions: string[] = [];
      const quantities: string[] = [];
      const unitPrices: string[] = [];
      const lineTotals: string[] = [];

      input.lines.forEach((line, index) => {
        lineNumbers.push(index + 1);
        descriptions.push(line.description);
        quantities.push(line.quantity.toFixed(4));
        unitPrices.push(line.unitPrice.toFixed(2));
        lineTotals.push((line.quantity * line.unitPrice).toFixed(2));
      });

      await client.query(
        `
          INSERT INTO tech_rica.invoice_lines (
            invoice_id,
            line_number,
            description,
            quantity,
            unit_price,
            line_total
          )
          SELECT
            $1::uuid,
            s.line_number,
            s.description,
            s.quantity,
            s.unit_price,
            s.line_total
          FROM unnest(
            $2::int[],
            $3::text[],
            $4::numeric[],
            $5::numeric[],
            $6::numeric[]
          ) AS s(line_number, description, quantity, unit_price, line_total)
        `,
        [invoice.invoice_id, lineNumbers, descriptions, quantities, unitPrices, lineTotals],
      );

      await client.query('COMMIT');

      return {
        invoiceId: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        totalAmount: Number(invoice.total_amount),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listInvoices(filters?: {
    invoiceType?: 'AR' | 'AP';
    status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'PAID' | 'VOID';
    limit?: number;
  }): Promise<{
    invoices: Array<{
      invoiceId: string;
      invoiceNumber: string;
      invoiceType: 'AR' | 'AP';
      counterpartyName: string;
      issueDate: string;
      dueDate: string;
      totalAmount: number;
      status: string;
      createdAt: string;
    }>;
    arAging: Array<{ label: string; value: number }>;
  }> {
    const values: Array<string | number> = [];
    const clauses: string[] = [];

    if (filters?.invoiceType) {
      values.push(filters.invoiceType);
      clauses.push(`invoice_type = $${values.length}`);
    }

    if (filters?.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }

    values.push(filters?.limit ?? 200);

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const listResult = await pgPool.query<{
      invoice_id: string;
      invoice_number: string;
      invoice_type: 'AR' | 'AP';
      counterparty_name: string;
      issue_date: Date;
      due_date: Date;
      total_amount: string;
      status: string;
      created_at: Date;
    }>(
      `
        SELECT
          invoice_id,
          invoice_number,
          invoice_type,
          counterparty_name,
          issue_date,
          due_date,
          total_amount,
          status,
          created_at
        FROM tech_rica.invoices
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${values.length}
      `,
      values,
    );

    const agingResult = await pgPool.query<{
      bucket: string;
      amount: string;
    }>(
      `
        WITH outstanding AS (
          SELECT
            CASE
              WHEN due_date >= CURRENT_DATE THEN '0-30d'
              WHEN CURRENT_DATE - due_date <= 30 THEN '31-60d'
              WHEN CURRENT_DATE - due_date <= 60 THEN '61-90d'
              ELSE '90+d'
            END AS bucket,
            total_amount
          FROM tech_rica.invoices
          WHERE invoice_type = 'AR'
            AND status IN ('SUBMITTED', 'APPROVED', 'POSTED')
        )
        SELECT bucket, COALESCE(SUM(total_amount), 0)::text AS amount
        FROM outstanding
        GROUP BY bucket
      `,
    );

    const buckets = new Map<string, number>([
      ['0-30d', 0],
      ['31-60d', 0],
      ['61-90d', 0],
      ['90+d', 0],
    ]);

    for (const row of agingResult.rows) {
      buckets.set(row.bucket, Number(row.amount));
    }

    return {
      invoices: listResult.rows.map((row) => ({
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        invoiceType: row.invoice_type,
        counterpartyName: row.counterparty_name,
        issueDate: row.issue_date.toISOString().slice(0, 10),
        dueDate: row.due_date.toISOString().slice(0, 10),
        totalAmount: Number(row.total_amount),
        status: row.status,
        createdAt: row.created_at.toISOString(),
      })),
      arAging: Array.from(buckets.entries()).map(([label, value]) => ({ label, value })),
    };
  }

  async submitInvoice(input: { invoiceId: string }): Promise<{ invoiceId: string; status: string }> {
    const result = await pgPool.query<{ invoice_id: string; status: string }>(
      `
        UPDATE tech_rica.invoices
        SET status = 'SUBMITTED'
        WHERE invoice_id = $1 AND status = 'DRAFT'
        RETURNING invoice_id, status
      `,
      [input.invoiceId],
    );

    if (!result.rowCount) {
      throw new AppError('Invoice cannot be submitted from current status', 409, 'INVOICE_SUBMIT_CONFLICT');
    }

    return {
      invoiceId: result.rows[0].invoice_id,
      status: result.rows[0].status,
    };
  }

  async approveInvoice(input: {
    invoiceId: string;
    approvedByUserId: string;
  }): Promise<{ invoiceId: string; status: string }> {
    const result = await pgPool.query<{ invoice_id: string; status: string }>(
      `
        UPDATE tech_rica.invoices
        SET status = 'APPROVED', approved_by = $2, approved_at = now()
        WHERE invoice_id = $1 AND status = 'SUBMITTED'
        RETURNING invoice_id, status
      `,
      [input.invoiceId, input.approvedByUserId],
    );

    if (!result.rowCount) {
      throw new AppError('Invoice cannot be approved from current status', 409, 'INVOICE_APPROVE_CONFLICT');
    }

    return {
      invoiceId: result.rows[0].invoice_id,
      status: result.rows[0].status,
    };
  }

  async postInvoiceToLedger(input: {
    invoiceId: string;
    postedByUserId: string;
    idempotencyKey?: string;
    referenceNo?: string;
    receivableOrExpenseAccountId: string;
    revenueOrPayableAccountId: string;
  }): Promise<{ invoiceId: string; status: string; journalEntryId: string }> {
    const result = await pgPool.query<{
      invoice_id: string;
      invoice_number: string;
      invoice_type: 'AR' | 'AP';
      total_amount: string;
      status: string;
      due_date: Date;
    }>(
      `
        SELECT invoice_id, invoice_number, invoice_type, total_amount, status, due_date
        FROM tech_rica.invoices
        WHERE invoice_id = $1
        LIMIT 1
      `,
      [input.invoiceId],
    );

    if (!result.rowCount) {
      throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    }

    const invoice = result.rows[0];

    if (invoice.status !== 'APPROVED') {
      throw new AppError('Only approved invoices can be posted', 409, 'INVOICE_POST_CONFLICT');
    }

    const amount = Number(invoice.total_amount);

    const posting =
      invoice.invoice_type === 'AR'
        ? await this.transactionService.postJournalEntry({
            idempotencyKey: input.idempotencyKey,
            referenceNo: input.referenceNo ?? invoice.invoice_number,
            description: `AR invoice ${invoice.invoice_number} posting`,
            transactionDate: invoice.due_date.toISOString().slice(0, 10),
            lines: [
              {
                accountId: input.receivableOrExpenseAccountId,
                entryType: 'DEBIT',
                amount,
                description: `Receivable for ${invoice.invoice_number}`,
              },
              {
                accountId: input.revenueOrPayableAccountId,
                entryType: 'CREDIT',
                amount,
                description: `Revenue for ${invoice.invoice_number}`,
              },
            ],
          })
        : await this.transactionService.postJournalEntry({
            idempotencyKey: input.idempotencyKey,
            referenceNo: input.referenceNo ?? invoice.invoice_number,
            description: `AP invoice ${invoice.invoice_number} posting`,
            transactionDate: invoice.due_date.toISOString().slice(0, 10),
            lines: [
              {
                accountId: input.receivableOrExpenseAccountId,
                entryType: 'DEBIT',
                amount,
                description: `Expense for ${invoice.invoice_number}`,
              },
              {
                accountId: input.revenueOrPayableAccountId,
                entryType: 'CREDIT',
                amount,
                description: `Payable for ${invoice.invoice_number}`,
              },
            ],
          });

    await pgPool.query(
      `
        UPDATE tech_rica.invoices
        SET status = 'POSTED', posted_journal_entry_id = $2, updated_at = now()
        WHERE invoice_id = $1
      `,
      [input.invoiceId, posting.journalEntryId],
    );

    return {
      invoiceId: input.invoiceId,
      status: 'POSTED',
      journalEntryId: posting.journalEntryId,
    };
  }
}
