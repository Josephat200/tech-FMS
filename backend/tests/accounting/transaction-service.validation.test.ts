import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { pgPool } from '../../src/infrastructure/db/postgres';
import { AppError } from '../../src/common/errors/AppError';
import { TransactionService } from '../../src/modules/accounting/application/services/TransactionService';

describe('Accounting engine validation', () => {
  const service = new TransactionService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fails fast on unbalanced entries without opening DB transaction', async () => {
    const connectSpy = jest.spyOn(pgPool, 'connect');

    await expect(
      service.postJournalEntry({
        description: 'Unbalanced entry',
        transactionDate: '2026-03-03',
        lines: [
          { accountId: 'acc-1', entryType: 'DEBIT', amount: 150 },
          { accountId: 'acc-2', entryType: 'CREDIT', amount: 100 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'JOURNAL_IMBALANCE' });

    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('prevents negative balance violations where account disallows negatives', async () => {
    const mockQuery = jest.fn(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ') {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes('INSERT INTO tech_rica.journal_entries')) {
        return {
          rowCount: 1,
          rows: [{ journal_entry_id: 'je-1', created_at: new Date('2026-03-03T00:00:00.000Z') }],
        };
      }

      if (sql.includes('FROM tech_rica.accounts')) {
        return {
          rowCount: 1,
          rows: [
            {
              account_id: '11111111-1111-1111-1111-111111111111',
              account_code: '1000',
              account_name: 'Cash',
              normal_balance: 'DEBIT',
              allow_negative: false,
              is_active: true,
            },
          ],
        };
      }

      if (sql.includes('FROM tech_rica.account_balances')) {
        return { rowCount: 0, rows: [] };
      }

      if (sql === 'ROLLBACK' || sql === 'COMMIT') {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const release = jest.fn();

    jest.spyOn(pgPool, 'connect').mockResolvedValue({
      query: mockQuery,
      release,
    } as never);

    await expect(
      service.postJournalEntry({
        description: 'Negative violation',
        transactionDate: '2026-03-03',
        lines: [
          {
            accountId: '11111111-1111-1111-1111-111111111111',
            entryType: 'CREDIT',
            amount: 100,
          },
          {
            accountId: '11111111-1111-1111-1111-111111111111',
            entryType: 'DEBIT',
            amount: 100,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(release).toHaveBeenCalled();
  });
});
