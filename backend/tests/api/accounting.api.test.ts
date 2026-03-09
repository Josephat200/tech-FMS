import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('Accounting API', () => {
  const app = createApp();

  it('requires authentication for posting journal entries', async () => {
    const response = await request(app).post('/api/v1/accounting/journal-entries').send({
      description: 'Unauthorized test',
      transactionDate: '2026-03-03',
      lines: [
        { accountId: '11111111-1111-1111-1111-111111111111', entryType: 'DEBIT', amount: 100 },
        { accountId: '22222222-2222-2222-2222-222222222222', entryType: 'CREDIT', amount: 100 },
      ],
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
