import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthToken, getAuthUser } from '@/lib/api';
import { canAccessAdminPortal } from '@/lib/permissions';

interface RequireAdminProps {
  children: ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const location = useLocation();
  const token = getAuthToken();
  const user = getAuthUser<{ role?: string; permissions?: Record<string, unknown> }>();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessAdminPortal(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
