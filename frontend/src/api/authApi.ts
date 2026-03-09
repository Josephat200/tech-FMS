import { httpClient } from './httpClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken?: string;
  requiresMfa: boolean;
  challengeId?: string;
  challengeExpiresAt?: string;
  deliveryChannel?: 'EMAIL' | 'DEV';
  devCode?: string;
};

export type VerifyMfaPayload = {
  challengeId: string;
  code: string;
};

export const authApi = {
  login: (payload: LoginPayload) =>
    httpClient.post<ApiEnvelope<LoginResponse>, LoginPayload>('/auth/login', payload, {
      auth: false,
    }),

  verifyMfa: (payload: VerifyMfaPayload) =>
    httpClient.post<ApiEnvelope<LoginResponse>, VerifyMfaPayload>('/auth/login/verify-mfa', payload, {
      auth: false,
    }),

  refresh: () =>
    httpClient.post<ApiEnvelope<{ accessToken: string }>, Record<string, never>>(
      '/auth/refresh',
      {},
      { auth: false },
    ),

  me: () => httpClient.get<ApiEnvelope<{ sub: string; email: string; roles: string[] }>>('/auth/me'),

  logout: () =>
    httpClient.post<ApiEnvelope<{ message: string }>, Record<string, never>>('/auth/logout', {}, { auth: false }),
};
