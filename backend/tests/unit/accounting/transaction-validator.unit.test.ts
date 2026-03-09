import { describe, expect, it } from '@jest/globals';
import { AppError } from '../../../src/common/errors/AppError';
import { validateJournalEntryInput } from '../../../src/modules/accounting/application/validators/transaction-validator';

describe('Transaction validator', () => {
  it('accepts balanced journal entries', () => {
    expect(() =>
      validateJournalEntryInput({
        description: 'Balanced entry',
        transactionDate: '2026-03-03',
        lines: [
          { accountId: 'acc-1', entryType: 'DEBIT', amount: 100 },
          { accountId: 'acc-2', entryType: 'CREDIT', amount: 100 },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects unbalanced journal entries', () => {
    try {
      validateJournalEntryInput({
        description: 'Unbalanced entry',
        transactionDate: '2026-03-03',
        lines: [
          { accountId: 'acc-1', entryType: 'DEBIT', amount: 100 },
          { accountId: 'acc-2', entryType: 'CREDIT', amount: 90 },
        ],
      });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('JOURNAL_IMBALANCE');
    }
  });
});
