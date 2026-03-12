import { AppDataProvider } from '@/contexts/AppDataContext';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Layout } from '@/components/layout/Layout';
import { Toaster } from '@/components/ui/toaster';

export default function AppShell() {
  return (
    <RequireAuth>
      <AppDataProvider>
        <Layout />
        <Toaster />
      </AppDataProvider>
    </RequireAuth>
  );
}
