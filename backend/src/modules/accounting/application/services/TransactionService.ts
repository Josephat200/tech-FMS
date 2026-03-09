import { PoolClient } from 'pg';
import { AppError } from '../../../../common/errors/AppError';
import { pgPool } from '../../../../infrastructure/db/postgres';
import {
  AccountRecord,
  CreateJournalEntryInput,
  JournalLineInput,
} from '../../domain/types/Accounting';
import { toCents, validateJournalEntryInput } from '../validators/transaction-validator';

type JournalPostResult = {
  journalEntryId: string;
  totalDebit: number;
  totalCredit: number;
  postedAt: string;
  isDuplicate: boolean;
};

export class TransactionService {
  async postJournalEntry(input: CreateJournalEntryInput): Promise<JournalPostResult> {
    validateJournalEntryInput(input);

    const parsedDate = new Date(input.transactionDate);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new AppError('Invalid transactionDate', 400, 'INVALID_TRANSACTION_DATE');
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

      const totals = this.computeTotals(input.lines);
      const accountIds = Array.from(new Set(input.lines.map((line) => line.accountId))).sort();

      const entry = await this.createJournalEntry(client, input);
      if (entry.isDuplicate) {
        await client.query('COMMIT');
        return {
          journalEntryId: entry.journalEntryId,
          totalDebit: 0,
          totalCredit: 0,
          postedAt: entry.createdAt,
          isDuplicate: true,
        };
      }

      const accounts = await this.lockAndGetAccounts(client, accountIds);
      const balances = await this.lockAndGetBalances(client, accountIds);

      const debitAmounts: string[] = [];
      const creditAmounts: string[] = [];
      const lineNumbers: number[] = [];
      const lineAccountIds: string[] = [];
      const lineDescriptions: Array<string | null> = [];

      for (let index = 0; index < input.lines.length; index += 1) {
        const line = input.lines[index];

        const account = accounts.get(line.accountId);
        if (!account) {
          throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');
        }

        if (!account.isActive) {
          throw new AppError(
            `Account is inactive: ${account.accountCode}`,
            400,
            'ACCOUNT_INACTIVE',
          );
        }

        this.applyBalanceUpdate(line, account, balances);

        lineNumbers.push(index + 1);
        lineAccountIds.push(line.accountId);
        lineDescriptions.push(line.description ?? null);
        debitAmounts.push(line.entryType === 'DEBIT' ? line.amount.toFixed(2) : '0.00');
        creditAmounts.push(line.entryType === 'CREDIT' ? line.amount.toFixed(2) : '0.00');
      }

      if (totals.totalDebitCents !== totals.totalCreditCents) {
        throw new AppError('Transaction is unbalanced', 400, 'JOURNAL_IMBALANCE');
      }

      await client.query(
        `
          INSERT INTO tech_rica.journal_lines (
            journal_entry_id,
            line_number,
            account_id,
            line_description,
            debit_amount,
            credit_amount
          )
          SELECT
            $1::uuid,
            s.line_number,
            s.account_id,
            s.line_description,
            s.debit_amount,
            s.credit_amount
          FROM unnest(
            $2::int[],
            $3::uuid[],
            $4::text[],
            $5::numeric[],
            $6::numeric[]
          ) AS s(line_number, account_id, line_description, debit_amount, credit_amount)
        `,
        [
          entry.journalEntryId,
          lineNumbers,
          lineAccountIds,
          lineDescriptions,
          debitAmounts,
          creditAmounts,
        ],
      );

      await this.persistBalances(client, balances);
      await client.query('COMMIT');

      return {
        journalEntryId: entry.journalEntryId,
        totalDebit: totals.totalDebitCents / 100,
        totalCredit: totals.totalCreditCents / 100,
        postedAt: new Date().toISOString(),
        isDuplicate: false,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private computeTotals(lines: JournalLineInput[]): { totalDebitCents: number; totalCreditCents: number } {
    let totalDebitCents = 0;
    let totalCreditCents = 0;

    for (const line of lines) {
      const cents = toCents(line.amount);
      if (line.entryType === 'DEBIT') {
        totalDebitCents += cents;
      } else {
        totalCreditCents += cents;
      }
    }

    return { totalDebitCents, totalCreditCents };
  }

  private async createJournalEntry(
    client: PoolClient,
    input: CreateJournalEntryInput,
  ): Promise<{ journalEntryId: string; createdAt: string; isDuplicate: boolean }> {
    const result = await client.query<{ journal_entry_id: string; created_at: Date }>(
      `
        INSERT INTO tech_rica.journal_entries (
          idempotency_key,
          reference_no,
          description,
          transaction_date,
          status
        ) VALUES ($1, $2, $3, $4, 'POSTED')
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING journal_entry_id, created_at
      `,
      [input.idempotencyKey ?? null, input.referenceNo ?? null, input.description, input.transactionDate],
    );

    if (result.rowCount && result.rows[0]) {
      return {
        journalEntryId: result.rows[0].journal_entry_id,
        createdAt: result.rows[0].created_at.toISOString(),
        isDuplicate: false,
      };
    }

    if (!input.idempotencyKey) {
      throw new AppError('Failed to create journal entry', 500, 'JOURNAL_CREATE_FAILED');
    }

    const existing = await client.query<{ journal_entry_id: string; created_at: Date }>(
      `
        SELECT journal_entry_id, created_at
        FROM tech_rica.journal_entries
        WHERE idempotency_key = $1
        LIMIT 1
      `,
      [input.idempotencyKey],
    );

    if (existing.rowCount === 0) {
      throw new AppError('Idempotent replay resolution failed', 409, 'IDEMPOTENCY_CONFLICT');
    }

    return {
      journalEntryId: existing.rows[0].journal_entry_id,
      createdAt: existing.rows[0].created_at.toISOString(),
      isDuplicate: true,
    };
  }

  private async lockAndGetAccounts(
    client: PoolClient,
    accountIds: string[],
  ): Promise<Map<string, AccountRecord>> {
    const result = await client.query<{
      account_id: string;
      account_code: string;
      account_name: string;
      normal_balance: 'DEBIT' | 'CREDIT';
      allow_negative: boolean;
      is_active: boolean;
    }>(
      `
        SELECT account_id, account_code, account_name, normal_balance, allow_negative, is_active
        FROM tech_rica.accounts
        WHERE account_id = ANY($1::uuid[])
        ORDER BY account_id
        FOR UPDATE
      `,
      [accountIds],
    );

    if (result.rowCount !== accountIds.length) {
      throw new AppError('One or more accounts do not exist', 404, 'ACCOUNT_NOT_FOUND');
    }

    const accountMap = new Map<string, AccountRecord>();
    for (const row of result.rows) {
      accountMap.set(row.account_id, {
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        normalBalance: row.normal_balance,
        allowNegative: row.allow_negative,
        isActive: row.is_active,
      });
    }

    return accountMap;
  }

  private async lockAndGetBalances(
    client: PoolClient,
    accountIds: string[],
  ): Promise<Map<string, number>> {
    const result = await client.query<{ account_id: string; balance: string }>(
      `
        SELECT account_id, balance
        FROM tech_rica.account_balances
        WHERE account_id = ANY($1::uuid[])
        ORDER BY account_id
        FOR UPDATE
      `,
      [accountIds],
    );

    const balances = new Map<string, number>();
    for (const accountId of accountIds) {
      balances.set(accountId, 0);
    }

    for (const row of result.rows) {
      balances.set(row.account_id, toCents(Number(row.balance)));
    }

    return balances;
  }

  private applyBalanceUpdate(
    line: JournalLineInput,
    account: AccountRecord,
    balances: Map<string, number>,
  ): void {
    const currentBalance = balances.get(account.accountId) ?? 0;
    const lineAmountCents = toCents(line.amount);

    const delta = line.entryType === account.normalBalance ? lineAmountCents : -lineAmountCents;
    const nextBalance = currentBalance + delta;

    if (!account.allowNegative && nextBalance < 0) {
      throw new AppError(
        `Negative balance not allowed for account ${account.accountCode}`,
        409,
        'NEGATIVE_BALANCE_VIOLATION',
      );
    }

    balances.set(account.accountId, nextBalance);
  }

  private async persistBalances(client: PoolClient, balances: Map<string, number>): Promise<void> {
    const entries = Array.from(balances.entries()).sort(([a], [b]) => a.localeCompare(b));
    const accountIds = entries.map(([accountId]) => accountId);
    const amounts = entries.map(([, balanceCents]) => (balanceCents / 100).toFixed(2));

    await client.query(
      `
        INSERT INTO tech_rica.account_balances (account_id, balance, updated_at)
        SELECT s.account_id, s.balance, now()
        FROM unnest($1::uuid[], $2::numeric[]) AS s(account_id, balance)
        ON CONFLICT (account_id)
        DO UPDATE SET balance = EXCLUDED.balance, updated_at = now()
      `,
      [accountIds, amounts],
    );
  }
}
