import { createContext, ReactNode, useEffect, useMemo, useState } from 'react';
import { authApi, LoginPayload } from '../api/authApi';
import { registerRefreshHandler, setAccessToken } from '../api/httpClient';
import { decodeJwtPayload } from '../utils/jwt';
import { AuthState, AuthUser } from '../types/auth';

type AuthContextValue = AuthState & {
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAccessToken = (token: string | null) => {
    setAccessToken(token);
    setAccessTokenState(token);
    setUser(token ? decodeJwtPayload(token) : null);
  };

  useEffect(() => {
    const refreshAccessToken = async (): Promise<string | null> => {
      try {
        const response = await authApi.refresh();
        const token = response.data.accessToken;
        applyAccessToken(token);
        return token;
      } catch {
        applyAccessToken(null);
        return null;
      }
    };

    registerRefreshHandler(refreshAccessToken);

    void (async () => {
      await refreshAccessToken();
      setIsLoading(false);
    })();
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await authApi.login(payload);
    if (response.data.requiresMfa) {
      throw new Error('MFA challenge returned by server but MFA UI is disabled. Contact administrator.');
    }

    if (!response.data.accessToken) {
      throw new Error('No access token received from login');
    }

    applyAccessToken(response.data.accessToken);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      applyAccessToken(null);
    }
  };

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    return user.roles.some((role) => roles.includes(role));
  };

  const value = useMemo(
    () => ({
      accessToken: accessTokenState,
      user,
      isLoading,
      login,
      logout,
      hasRole,
    }),
    [accessTokenState, user, isLoading, login],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
