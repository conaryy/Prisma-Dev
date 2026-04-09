import { Suspense, lazy } from 'react';
import { LoadingState } from '@/components/states/LoadingState';
import { getAuthUser } from '@/lib/api';
import { canAccessExternalDnp } from '@/lib/permissions';

const ExternalDnpDashboard = lazy(() =>
  import('@/pages/Dashboard').then((module) => ({ default: module.Dashboard }))
);

const StandardDashboard = lazy(() =>
  import('@/pages/Dashboard2').then((module) => ({ default: module.Dashboard }))
);

export function DashboardEntry() {
  const authUser = getAuthUser<{
    can_access_external_dnp?: boolean;
    permissions?: Record<string, unknown>;
  }>();
  const hasExternalDnpAccess = canAccessExternalDnp(authUser);

  return (
    <Suspense fallback={<LoadingState message="Memuat dashboard..." />}>
      {hasExternalDnpAccess ? <ExternalDnpDashboard /> : <StandardDashboard />}
    </Suspense>
  );
}
