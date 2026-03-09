import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('Auth integration', () => {
  const app = createApp();

  it('rejects /auth/me request without bearer token', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
