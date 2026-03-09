import { AuthUser } from '../types/auth';

export function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;

    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    const payload = JSON.parse(decoded) as AuthUser;

    if (!payload?.sub || !payload?.email || !Array.isArray(payload?.roles)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
