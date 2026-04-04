import {
  Bell,
  ClipboardCheck,
  ChevronDown,
  LayoutDashboard,
  Moon,
  NotebookTabs,
  Search,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};

  const portalLinks = useMemo(
    () => [
      {
        label: 'Dashboard',
        href: env.VITE_PORTAL_DASHBOARD_URL ?? 'https://prisma.ryvidia.my.id/portal-admin',
        icon: LayoutDashboard,
        accent: 'from-cyan-400 to-sky-500',
      },
      {
        label: 'Keamanan',
        href: env.VITE_PORTAL_KEAMANAN_URL ?? 'https://prisma.ryvidia.my.id/portal-admin',
        icon: ShieldCheck,
        accent: 'from-emerald-400 to-teal-500',
      },
      {
        label: 'K3',
        href: env.VITE_PORTAL_K3_URL ?? 'https://prisma.ryvidia.my.id/portal-admin',
        icon: ClipboardCheck,
        accent: 'from-amber-400 to-orange-500',
      },
      {
        label: 'Logbook',
        href: env.VITE_PORTAL_LOGBOOK_URL ?? window.location.origin,
        icon: NotebookTabs,
        accent: 'from-violet-400 to-fuchsia-500',
      },
    ],
    [env]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!portalMenuRef.current) {
        return;
      }
      if (!portalMenuRef.current.contains(event.target as Node)) {
        setIsPortalMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPortalMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

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
          <div ref={portalMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsPortalMenuOpen((value) => !value)}
              className={`inline-flex h-10 items-center gap-1 rounded-xl border px-3 text-sm font-semibold text-slate-100 transition ${
                isPortalMenuOpen
                  ? 'border-violet-300/45 bg-[#3d1c73]'
                  : 'border-violet-300/35 bg-[#2a1451] hover:bg-[#391a6d]'
              }`}
            >
              Portal
              <ChevronDown className={`h-4 w-4 transition-transform ${isPortalMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPortalMenuOpen && (
              <div className="absolute right-0 top-14 w-[14.5rem] rounded-2xl border border-violet-200/20 bg-[linear-gradient(180deg,rgba(20,12,36,0.98)_0%,rgba(14,10,27,0.98)_100%)] p-3 shadow-[0_24px_70px_rgba(5,8,20,0.55)]">
                <div className="mb-3 px-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/90">Portal Prisma</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {portalLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        className="group min-w-0 rounded-2xl border border-white/10 bg-[#1a1530] px-2 py-3 text-center transition hover:border-violet-300/22 hover:bg-[#241d3f]"
                      >
                        <div
                          className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-lg shadow-black/20`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-[11px] font-medium leading-4 text-slate-100">{item.label}</div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
