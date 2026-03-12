import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthToken, getAuthUser } from '@/lib/api';

interface RequireExternalDnpProps {
  children: ReactNode;
}

export function RequireExternalDnp({ children }: RequireExternalDnpProps) {
  const location = useLocation();
  const token = getAuthToken();
  const user = getAuthUser<{ can_access_external_dnp?: boolean }>();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.can_access_external_dnp === false) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

