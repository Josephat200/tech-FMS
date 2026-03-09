import { describe, expect, it } from '@jest/globals';
import { hashPassword, verifyPassword } from '../../../src/infrastructure/security/hash';

describe('Hash utilities', () => {
  it('hashes and verifies password correctly', async () => {
    const plain = 'VerySecurePassword!123';
    const hash = await hashPassword(plain);

    expect(hash).not.toEqual(plain);
    await expect(verifyPassword(plain, hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
