import {
  Bell,
  ClipboardCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Moon,
  NotebookTabs,
  Search,
  ShieldCheck,
  Sun,
  UserCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BurgerButton from '../ui/BurgerButton';
import { clearSessionToken } from '../../lib/session';
import { buildSsoLogoutUrl, isSsoEnabled } from '../../lib/sso';
import { ThemeMode } from '../../lib/theme';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function resolvePortalBaseUrl(target: 'auth' | 'k2s' | 'k3' | 'keamanan') {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (target === 'auth') return `${protocol}//${hostname}:5174`;
      if (target === 'k2s') return `${protocol}//${hostname}:5173`;
      if (target === 'k3') return `${protocol}//${hostname}:5176`;
      return `${protocol}//${hostname}:5177`;
    }

    if (hostname.startsWith('logbook.')) {
      if (target === 'auth') return `${protocol}//${hostname.replace(/^logbook\./, 'auth.')}`;
      if (target === 'k2s') return `${protocol}//${hostname.replace(/^logbook\./, 'k2s.')}`;
      if (target === 'k3') return `${protocol}//${hostname.replace(/^logbook\./, 'k3.')}`;
      return `${protocol}//${hostname.replace(/^logbook\./, 'keamanan.')}`;
    }
  }

  if (target === 'auth') return 'https://auth.ryvidia.my.id';
  if (target === 'k2s') return 'https://k2s.ryvidia.my.id';
  if (target === 'k3') return 'https://k3.ryvidia.my.id';
  return 'https://keamanan.ryvidia.my.id';
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

export default function Topbar({
  isSidebarOpen,
  onToggleSidebar,
  themeMode,
  onToggleTheme,
}: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTitle = getActiveMenuTitle(location.pathname);
  const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};

  const portalLinks = useMemo(
    () => [
      {
        label: 'Dashboard',
        href: env.VITE_PORTAL_DASHBOARD_URL?.trim()
          ? normalizeBaseUrl(env.VITE_PORTAL_DASHBOARD_URL)
          : `${resolvePortalBaseUrl('auth')}/portal-admin`,
        icon: LayoutDashboard,
        accent: 'from-cyan-400 to-sky-500',
      },
      {
        label: 'Keamanan',
        href: env.VITE_PORTAL_KEAMANAN_URL?.trim()
          ? normalizeBaseUrl(env.VITE_PORTAL_KEAMANAN_URL)
          : resolvePortalBaseUrl('keamanan'),
        icon: ShieldCheck,
        accent: 'from-emerald-400 to-teal-500',
      },
      {
        label: 'K3',
        href: env.VITE_PORTAL_K3_URL?.trim()
          ? normalizeBaseUrl(env.VITE_PORTAL_K3_URL)
          : resolvePortalBaseUrl('k3'),
        icon: ClipboardCheck,
        accent: 'from-amber-400 to-orange-500',
      },
      {
        label: 'K2S',
        href: env.VITE_PORTAL_K2S_URL?.trim()
          ? normalizeBaseUrl(env.VITE_PORTAL_K2S_URL)
          : resolvePortalBaseUrl('k2s'),
        icon: NotebookTabs,
        accent: 'from-violet-400 to-fuchsia-500',
      },
    ],
    [env]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (portalMenuRef.current && !portalMenuRef.current.contains(event.target as Node)) {
        setIsPortalMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPortalMenuOpen(false);
        setIsProfileMenuOpen(false);
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

    const authPortalUrl = env.VITE_AUTH_PORTAL_URL ?? 'https://prisma.ryvidia.my.id/login';
    try {
      const parsed = new URL(authPortalUrl);
      const logoutUrl = new URL('/auth/logout', parsed.origin);
      logoutUrl.searchParams.set('post_logout_redirect_uri', `${window.location.origin}/`);
      window.location.replace(logoutUrl.toString());
      return;
    } catch {
      navigate('/', { replace: true });
    }
  };

  const ThemeIcon = themeMode === 'dark' ? Sun : Moon;
  const themeLabel = themeMode === 'dark' ? 'Light' : 'Dark';

  return (
    <header
      className={`fixed top-4 right-4 z-40 transition-all duration-300 ${
        isSidebarOpen ? 'left-4 lg:left-[19rem]' : 'left-4'
      }`}
    >
      <div
        className="flex h-20 w-full items-center justify-between gap-4 rounded-xl border px-4 backdrop-blur-xl"
        style={{
          background: 'var(--topbar-bg)',
          borderColor: 'var(--border-strong)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <BurgerButton isOpen={isSidebarOpen} onClick={onToggleSidebar} />
          <h1 className="truncate text-base font-semibold sm:text-xl" style={{ color: 'var(--text-primary)' }}>
            {activeTitle}
          </h1>
        </div>

        <div className="hidden max-w-xl flex-1 lg:block">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari logbook, accident , dll"
              className="theme-control h-11 w-full rounded-xl pl-10 pr-3 text-sm"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="hidden h-10 items-center gap-1 rounded-xl border px-3 text-sm font-semibold transition sm:inline-flex"
            style={{
              background: 'var(--accent-soft)',
              borderColor: 'var(--border-strong)',
              color: 'var(--accent)',
            }}
          >
            <ThemeIcon className="h-4 w-4" />
            {themeLabel}
          </button>
          <div ref={portalMenuRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => {
                setIsPortalMenuOpen((value) => !value);
                setIsProfileMenuOpen(false);
              }}
              className="inline-flex h-10 items-center gap-1 rounded-xl border px-3 text-sm font-semibold transition"
              style={{
                background: isPortalMenuOpen ? 'var(--surface-hover)' : 'var(--surface-soft)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              Portal
              <ChevronDown className={`h-4 w-4 transition-transform ${isPortalMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPortalMenuOpen && (
              <div
                className="absolute right-0 top-14 w-[14.5rem] rounded-2xl border p-3"
                style={{
                  background: 'var(--portal-popover-bg)',
                  borderColor: 'var(--portal-popover-border)',
                  boxShadow: '0 24px 70px rgba(5, 8, 20, 0.45)',
                }}
              >
                <div className="mb-3 px-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--portal-popover-muted)' }}>Portal Prisma</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {portalLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        className="group min-w-0 rounded-2xl border px-2 py-3 text-center transition"
                        style={{
                          background: 'var(--portal-popover-card-bg)',
                          borderColor: 'var(--portal-popover-card-border)',
                        }}
                      >
                        <div
                          className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-lg shadow-black/20`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-[11px] font-medium leading-4" style={{ color: 'var(--portal-popover-text)' }}>{item.label}</div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button
            className="hidden h-10 w-10 items-center justify-center rounded-xl border transition sm:inline-flex"
            style={{
              background: 'var(--surface-soft)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-secondary)',
            }}
          >
            <Bell className="h-5 w-5" />
          </button>
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsProfileMenuOpen((value) => !value);
                setIsPortalMenuOpen(false);
              }}
              title="Profil"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition"
              style={{
                background: isProfileMenuOpen ? 'var(--surface-hover)' : 'var(--surface-soft)',
                borderColor: 'var(--border-soft)',
                color: 'var(--text-secondary)',
              }}
            >
              <UserCircle className="h-5 w-5" />
            </button>

            {isProfileMenuOpen && (
              <div
                className="absolute right-0 top-14 w-[11rem] rounded-2xl border p-2"
                style={{
                  background: 'var(--portal-popover-bg)',
                  borderColor: 'var(--portal-popover-border)',
                  boxShadow: '0 24px 70px rgba(5, 8, 20, 0.45)',
                }}
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition"
                  style={{
                    background: 'var(--portal-popover-card-bg)',
                    borderColor: 'var(--portal-popover-card-border)',
                    color: 'var(--portal-popover-text)',
                  }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
