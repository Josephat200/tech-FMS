import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('Reports API', () => {
  const app = createApp();

  it('requires authentication for trial balance endpoint', async () => {
    const response = await request(app).get('/api/v1/reports/trial-balance?asOf=2026-03-03');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
