import { useEffect } from 'react';
import { AppDataProvider } from '@/contexts/AppDataContext';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Layout } from '@/components/layout/Layout';
import { Toaster } from '@/components/ui/toaster';
import { apiFetch, clearAuthToken, clearAuthUser, getAuthToken, setAuthUser } from '@/lib/api';

export default function AppShell() {
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    apiFetch<{ data: Record<string, unknown> }>('/api/auth/me')
      .then((response) => {
        if (response?.data) {
          setAuthUser(response.data);
        }
      })
      .catch(() => {
        clearAuthToken();
        clearAuthUser();
      });
  }, []);

  return (
    <RequireAuth>
      <AppDataProvider>
        <Layout />
        <Toaster />
      </AppDataProvider>
    </RequireAuth>
  );
}
