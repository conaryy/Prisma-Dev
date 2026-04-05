import { useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { getSessionToken } from '../../lib/session';
import { isSsoEnabled, startSsoLogin } from '../../lib/sso';
import { applyTheme, persistTheme, resolveInitialTheme, ThemeMode } from '../../lib/theme';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(resolveInitialTheme);
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

  useEffect(() => {
    applyTheme(themeMode);
    persistTheme(themeMode);
  }, [themeMode]);

  const handleToggleTheme = () => {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  if (isCallbackPath) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundImage: 'var(--body-bg)' }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-blue-500/12 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-violet-600/16 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/12 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:80px_80px] opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,20,0.02)_0%,rgba(6,10,20,0.18)_100%)]" />
      </div>

      <div className="relative z-10">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <Topbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
        />

        <main
          className={`pt-24 transition-all duration-300 ${
            isSidebarOpen ? 'lg:ml-[18rem]' : 'lg:ml-0'
          }`}
        >
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
