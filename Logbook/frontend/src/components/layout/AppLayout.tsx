import { useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { getSessionToken } from '../../lib/session';
import { isSsoEnabled, startSsoLogin } from '../../lib/sso';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isCallbackPath = location.pathname.startsWith('/auth/callback');

  useEffect(() => {
    if (isCallbackPath) {
      return;
    }

    const token = getSessionToken();
    if (token) {
      return;
    }

    if (isSsoEnabled()) {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      startSsoLogin(returnTo).catch(() => {});
      return;
    }

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return;
    }

    const authPortalUrl =
      (import.meta as { env?: Record<string, string> }).env?.VITE_AUTH_PORTAL_URL ??
      'https://prisma.ryvidia.my.id/login';
    window.location.href = authPortalUrl;
  }, [isCallbackPath]);

  if (isCallbackPath) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Topbar isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      <main className={`pt-24 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
