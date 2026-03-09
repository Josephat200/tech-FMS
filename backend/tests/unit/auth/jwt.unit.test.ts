import { describe, expect, it } from '@jest/globals';
import { signAccessToken, verifyAccessToken } from '../../../src/infrastructure/security/jwt';

describe('JWT utilities', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken({
      sub: 'user-1',
      email: 'user@techrica.test',
      roles: ['USER'],
    });

    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('user@techrica.test');
    expect(payload.roles).toEqual(['USER']);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken({
      sub: 'user-2',
      email: 'tamper@techrica.test',
      roles: ['ADMIN'],
    });

    const tampered = `${token}x`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
