import { useEffect } from 'react';
import { getAuthPortalUrl } from '@/lib/authPortal';

export function UserManagement() {
  useEffect(() => {
    window.location.replace(getAuthPortalUrl('/portal-admin/users', { includeToken: true }));
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
      Mengalihkan ke Portal Admin untuk kelola user SSO...
    </div>
  );
}
