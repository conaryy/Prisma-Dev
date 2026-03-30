import { Bell, ChevronDown, Moon, Search, UserCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import BurgerButton from '../ui/BurgerButton';
import { clearSessionToken } from '../../lib/session';
import { buildSsoLogoutUrl, isSsoEnabled } from '../../lib/sso';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getActiveMenuTitle(pathname: string) {
  if (pathname === '/') {
    return 'Dashboard';
  }

  const parts = pathname.split('/').filter(Boolean);
  const category = parts[0] ? toTitleCase(parts[0]) : '';
  const page = parts[1] ?? '';

  if (page === 'logbook-harian') {
    return `Logbook${category ? ` - ${category}` : ''}`;
  }
  if (page === 'rekap-logbook') {
    return `Rekap Logbook${category ? ` - ${category}` : ''}`;
  }

  return 'Logbook Dashboard';
}

export default function Topbar({ isSidebarOpen, onToggleSidebar }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTitle = getActiveMenuTitle(location.pathname);

  const handlePortalClick = () => {
    const authPortalUrl =
      (import.meta as { env?: Record<string, string> }).env?.VITE_AUTH_PORTAL_URL ??
      'https://prisma.ryvidia.my.id/portal-admin';
    window.location.href = authPortalUrl.replace(/\/login$/, '/portal-admin');
  };

  const handleLogout = () => {
    clearSessionToken();
    if (isSsoEnabled()) {
      const target = `${window.location.origin}/`;
      window.location.replace(buildSsoLogoutUrl(target, 'logbook-web'));
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <header className={`fixed top-4 right-4 z-40 transition-all duration-300 ${isSidebarOpen ? 'left-4 lg:left-[17rem]' : 'left-4'}`}>
      <div className="flex h-20 w-full items-center justify-between gap-4 rounded-xl border border-violet-400/35 bg-[#190d33]/88 px-4 shadow-[0_12px_30px_rgba(10,6,25,0.55)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <BurgerButton isOpen={isSidebarOpen} onClick={onToggleSidebar} />
          <h1 className="truncate text-xl font-semibold text-slate-100">{activeTitle}</h1>
        </div>

        <div className="hidden max-w-xl flex-1 lg:block">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari logbook, accident , dll"
              className="h-11 w-full rounded-xl border border-violet-300/25 bg-[#1f1140]/80 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-300/60 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex h-10 items-center gap-1 rounded-xl border border-violet-300/35 bg-violet-500/35 px-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/45">
            <Moon className="h-4 w-4" />
            Dark
          </button>
          <button
            onClick={handlePortalClick}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-violet-300/35 bg-[#2a1451] px-3 text-sm font-semibold text-slate-100 transition hover:bg-[#391a6d]"
          >
            Portal
            <ChevronDown className="h-4 w-4" />
          </button>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/30 bg-[#1f1140]/80 text-slate-200 transition hover:bg-[#2e185c]">
            <Bell className="h-5 w-5" />
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/30 bg-[#1f1140]/80 text-slate-200 transition hover:bg-[#2e185c]"
          >
            <UserCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
