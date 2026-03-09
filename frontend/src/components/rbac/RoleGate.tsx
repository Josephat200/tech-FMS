import { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';

type RoleGateProps = {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { hasRole } = useAuth();
  return hasRole(allowedRoles) ? <>{children}</> : <>{fallback}</>;
}
