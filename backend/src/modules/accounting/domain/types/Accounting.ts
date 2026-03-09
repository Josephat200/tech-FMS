export type EntryType = 'DEBIT' | 'CREDIT';

export type JournalLineInput = {
  accountId: string;
  entryType: EntryType;
  amount: number;
  description?: string;
};

export type CreateJournalEntryInput = {
  idempotencyKey?: string;
  referenceNo?: string;
  description: string;
  transactionDate: string;
  lines: JournalLineInput[];
};

export type AccountRecord = {
  accountId: string;
  accountCode: string;
  accountName: string;
  normalBalance: EntryType;
  allowNegative: boolean;
  isActive: boolean;
};

export type AccountBalanceRecord = {
  accountId: string;
  balance: number;
};
