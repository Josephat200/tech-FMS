import { AppError } from '../../../../common/errors/AppError';
import { CreateJournalEntryInput } from '../../domain/types/Accounting';

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function validateJournalEntryInput(input: CreateJournalEntryInput): void {
  if (!input.lines || input.lines.length < 2) {
    throw new AppError('A journal entry must contain at least two lines', 400, 'INVALID_JOURNAL_LINES');
  }

  if (!input.description?.trim()) {
    throw new AppError('Description is required', 400, 'INVALID_JOURNAL_DESCRIPTION');
  }

  let debitTotalCents = 0;
  let creditTotalCents = 0;

  for (const line of input.lines) {
    if (!line.accountId) {
      throw new AppError('Each journal line must have an accountId', 400, 'INVALID_JOURNAL_LINE_ACCOUNT');
    }

    if (!Number.isFinite(line.amount) || line.amount <= 0) {
      throw new AppError('Journal line amount must be a positive number', 400, 'INVALID_JOURNAL_LINE_AMOUNT');
    }

    const cents = toCents(line.amount);
    if (line.entryType === 'DEBIT') {
      debitTotalCents += cents;
    } else {
      creditTotalCents += cents;
    }
  }

  if (debitTotalCents !== creditTotalCents) {
    throw new AppError('Journal entry is unbalanced: debits must equal credits', 400, 'JOURNAL_IMBALANCE');
  }
}
