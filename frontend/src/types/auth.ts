export type UserRole =
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'FINANCE_MANAGER'
  | 'HR'
  | 'AUDITOR'
  | 'DEPARTMENT_MANAGER'
  | 'USER';

export type AuthUser = {
  sub: string;
  email: string;
  roles: UserRole[];
};

export type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;
};
