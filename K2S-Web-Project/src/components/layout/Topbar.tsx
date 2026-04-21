import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { getStoredTheme, persistTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { getAuthPortalUrl } from '@/lib/authPortal';
import {
  canAccessAdminPortal,
  canAccessK2sDashboard,
  canAccessK3,
  canAccessKeamanan,
  canAccessLogbook,
  canAccessExternalDnp,
  canManageAdminModule,
} from '@/lib/permissions';
import { buildSsoLogoutUrl, isSsoEnabled } from '@/lib/sso';
import burgerMenu from '@/assets/burger-menu.json';
import { apiFetch, clearAuthToken, clearAuthUser, getAuthToken, getAuthUser } from '@/lib/api';
import { fetchNotifications } from '@/lib/notifications';
import { useAppData } from '@/contexts/AppDataContext';

interface TopbarProps {
  onMenuClick?: () => void;
  onCollapseToggle?: () => void;
  isSidebarOpen?: boolean;
  isSidebarCollapsed?: boolean;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function getLogbookPortalUrl() {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  return normalizeBaseUrl(env.VITE_LOGBOOK_BASE_URL || 'http://localhost:5175');
}

function getK3PortalUrl() {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  return normalizeBaseUrl(env.VITE_K3_BASE_URL || 'http://localhost:5176');
}

function getKeamananPortalUrl() {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  return normalizeBaseUrl(env.VITE_KEAMANAN_BASE_URL || 'http://localhost:5177');
}

type PortalShortcut = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  buttonClassName: string;
  ringClassName: string;
};

const MENU_LOTTIE_FALLBACK_END = Math.max(
  0,
  Math.floor((burgerMenu as { op?: number }).op ?? 100)
);
const MENU_LOTTIE_OPEN_FRAME = 67;
const MENU_LOTTIE_SPEED = 1.75;

interface MenuLottieIconProps {
  isOpen?: boolean;
  animate?: boolean;
}

function MenuLottieIcon({ isOpen, animate = true }: MenuLottieIconProps) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const [isReady, setIsReady] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const lottie = lottieRef.current;
    if (!lottie) {
      return;
    }

    const duration = lottie.getDuration(true);
    const endFrame =
      typeof duration === 'number' && Number.isFinite(duration) && duration > 0
        ? Math.max(0, Math.floor(duration))
        : MENU_LOTTIE_FALLBACK_END;
    const openFrame = Math.max(
      0,
      Math.min(MENU_LOTTIE_OPEN_FRAME, endFrame)
    );
    const targetFrame =
      typeof isOpen === 'boolean' && isOpen ? openFrame : 0;

    if (!animate || typeof isOpen !== 'boolean') {
      lottie.goToAndStop(targetFrame, true);
      return;
    }

    if (!hasMounted.current) {
      lottie.goToAndStop(targetFrame, true);
      hasMounted.current = true;
      return;
    }

    lottie.setSpeed(MENU_LOTTIE_SPEED);

    if (isOpen) {
      lottie.playSegments([0, openFrame], true);
      return;
    }

    lottie.playSegments([openFrame, 0], true);
  }, [animate, isOpen, isReady]);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={burgerMenu}
      autoplay={false}
      loop={false}
      onDOMLoaded={() => setIsReady(true)}
      className="pointer-events-none h-7 w-7 transition-[filter] duration-200 dark:brightness-0 dark:invert"
      aria-hidden="true"
    />
  );
}

export function Topbar({
  onMenuClick,
  onCollapseToggle,
  isSidebarOpen,
  isSidebarCollapsed,
}: TopbarProps) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const menuLabel = isSidebarOpen ? 'Tutup menu' : 'Buka menu';
  const collapseLabel = isSidebarCollapsed
    ? 'Tampilkan sidebar'
    : 'Sembunyikan sidebar';
  const authUser = getAuthUser<{
    role?: string;
    name?: string;
    can_access_external_dnp?: boolean;
    permissions?: Record<string, unknown>;
  }>();
  const canAccessAdminMenu = canManageAdminModule(authUser);
  const canAccessCentralAdminPortal = canAccessAdminPortal(authUser);
  const canAccessK2sPortal = canAccessK2sDashboard(authUser);
  const canAccessLogbookPortal = canAccessLogbook(authUser);
  const canAccessK3Portal = canAccessK3(authUser);
  const canAccessKeamananPortal = canAccessKeamanan(authUser);
  const canAccessExternalDnpMenu = canAccessExternalDnp(authUser);
  const { instansi } = useAppData();
  const profileName =
    authUser?.name?.trim() || instansi?.name?.trim() || 'Pengguna';

  const portalItems = useMemo<PortalShortcut[]>(
    () =>
      [
        canAccessK2sPortal
          ? {
              key: 'dashboard',
              label: 'Dashboard',
              href: getAuthPortalUrl(
                canAccessCentralAdminPortal ? '/portal-admin' : '/portal-user',
                { includeToken: true }
              ),
              icon: LayoutDashboard,
              buttonClassName: 'bg-gradient-to-br from-sky-500 to-blue-500',
              ringClassName: 'focus-visible:ring-blue-200',
            }
          : null,
        canAccessKeamananPortal
          ? {
              key: 'keamanan',
              label: 'Keamanan',
              href: getKeamananPortalUrl(),
              icon: ShieldCheck,
              buttonClassName: 'bg-gradient-to-br from-blue-500 to-sky-400',
              ringClassName: 'focus-visible:ring-blue-200',
            }
          : null,
        canAccessK3Portal
          ? {
              key: 'k3',
              label: 'K3',
              href: getK3PortalUrl(),
              icon: ClipboardCheck,
              buttonClassName: 'bg-gradient-to-br from-emerald-500 to-teal-400',
              ringClassName: 'focus-visible:ring-emerald-200',
            }
          : null,
        canAccessLogbookPortal
          ? {
              key: 'logbook',
              label: 'Logbook',
              href: getLogbookPortalUrl(),
              icon: BookOpen,
              buttonClassName: 'bg-gradient-to-br from-violet-500 to-indigo-400',
              ringClassName: 'focus-visible:ring-violet-200',
            }
          : null,
      ].filter((item): item is PortalShortcut => item !== null),
    [
      canAccessCentralAdminPortal,
      canAccessK2sPortal,
      canAccessKeamananPortal,
      canAccessK3Portal,
      canAccessLogbookPortal,
    ]
  );

  const portalGridClassName = useMemo(() => {
    if (portalItems.length >= 4) {
      return 'grid-cols-4';
    }
    if (portalItems.length === 3) {
      return 'grid-cols-3';
    }
    if (portalItems.length === 2) {
      return 'grid-cols-2';
    }
    return 'grid-cols-1';
  }, [portalItems.length]);

  const menuItems = useMemo(
    () =>
      [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Profil', path: '/profile' },
        { label: 'Informasi Instansi - Profil', path: '/informasi/instansi/profil' },
        { label: 'Informasi Instansi - Fasilitas', path: '/informasi/instansi/fasilitas' },
        { label: 'Informasi Instansi - Organisasi', path: '/informasi/instansi/organisasi' },
        { label: 'Informasi Instansi - Personil', path: '/informasi/instansi/personil' },
        { label: 'Informasi Instansi - Sertifikat', path: '/informasi/instansi/sertifikat' },
        { label: 'Informasi Instansi - Pemenuhan Sertifikat', path: '/informasi/instansi/sertifikat/pemenuhan' },
        { label: 'Agenda Pengawasan', path: '/informasi/agenda-pengawasan' },
        { label: 'Hasil Audit', path: '/audit' },
        { label: 'Audit - Self Assessment', path: '/audit/protocol-question/self-assessment' },
        { label: 'Audit - Hasil Review Unit Safety', path: '/audit/protocol-question/hasil-review-dgca' },
        { label: 'Audit - CAP Penyusunan', path: '/audit/cap/penyusunan' },
        { label: 'Audit - CAP Pemenuhan', path: '/audit/cap/pemenuhan' },
        { label: 'Hasil Inspeksi', path: '/inspeksi' },
        { label: 'Inspeksi - Self Assessment', path: '/inspeksi/protocol-question/self-assessment' },
        { label: 'Inspeksi - Hasil Review Unit Safety', path: '/inspeksi/protocol-question/hasil-review-dgca' },
        { label: 'Inspeksi - CAP Penyusunan', path: '/inspeksi/cap/penyusunan' },
        { label: 'Inspeksi - CAP Pemenuhan', path: '/inspeksi/cap/pemenuhan' },
        { label: 'Hasil Monitoring', path: '/monitoring' },
        { label: 'Monitoring - Agenda Monitoring', path: '/monitoring/protocol-question/hasil-review-dgca' },
        { label: 'Hasil Surveillance', path: '/surveillance' },
        { label: 'Surveillance - Self Assessment', path: '/surveillance/protocol-question/self-assessment' },
        { label: 'Surveillance - Hasil Review Unit Safety', path: '/surveillance/protocol-question/hasil-review-dgca' },
        { label: 'Surveillance - CAP Penyusunan', path: '/surveillance/cap/penyusunan' },
        { label: 'Surveillance - CAP Pemenuhan', path: '/surveillance/cap/pemenuhan' },
        { label: 'External DNP - Audit - CAP Penyusunan', path: '/external-dnp/audit/cap/penyusunan' },
        { label: 'External DNP - Audit - CAP Pemenuhan', path: '/external-dnp/audit/cap/pemenuhan' },
        { label: 'External DNP - Inspeksi - CAP Penyusunan', path: '/external-dnp/inspeksi/cap/penyusunan' },
        { label: 'External DNP - Inspeksi - CAP Pemenuhan', path: '/external-dnp/inspeksi/cap/pemenuhan' },
        { label: 'External DNP - Surveillance - CAP Penyusunan', path: '/external-dnp/surveillance/cap/penyusunan' },
        { label: 'External DNP - Surveillance - CAP Pemenuhan', path: '/external-dnp/surveillance/cap/pemenuhan' },
        { label: 'Temuan', path: '/temuan' },
        { label: 'CAP', path: '/cap' },
        { label: 'Admin - Dashboard', path: '/admin', adminOnly: true },
        {
          label: 'Admin - Kelola User',
          path: '/admin/users',
          externalUrl: getAuthPortalUrl('/portal-admin/users', { includeToken: true }),
          adminOnly: true,
        },
        {
          label: 'Admin - Pertanyaan Self Assessment',
          path: '/admin/self-assessment',
          adminOnly: true,
        },
        {
          label: 'Admin - Sesi Self Assessment',
          path: '/admin/self-assessment-sessions',
          adminOnly: true,
        },
        {
          label: 'Admin - Review Monitoring',
          path: '/admin/monitoring-reviews',
          adminOnly: true,
        },
        {
          label: 'Admin - Review Unit Safety',
          path: '/admin/self-assessment-reviews',
          adminOnly: true,
        },
        {
          label: 'Admin - Review CAP',
          path: '/admin/self-assessment-cap-reviews',
          adminOnly: true,
        },
        {
          label: 'Admin - Hasil Pemenuhan CAP',
          path: '/admin/self-assessment-cap-fulfillments',
          adminOnly: true,
        },
      ].filter((item) => {
        if (item.path.startsWith('/external-dnp') && !canAccessExternalDnpMenu) {
          return false;
        }
        return item.adminOnly ? canAccessAdminMenu : true;
      }),
    [canAccessAdminMenu, canAccessExternalDnpMenu]
  );

  const filteredMenu = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return [];
    }
    return menuItems.filter((item) =>
      item.label.toLowerCase().includes(term)
    );
  }, [menuItems, searchTerm]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    let isMounted = true;

    const loadUnread = () => {
      fetchNotifications({ limit: 1 })
        .then((data) => {
          if (isMounted) {
            setUnreadCount(data.unreadCount);
          }
        })
        .catch(() => {});
    };

    loadUnread();
    const timerId = window.setInterval(loadUnread, 20000);

    return () => {
      isMounted = false;
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!searchRef.current) {
        return;
      }
      if (!searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    persistTheme(theme);
  }, [theme]);

  const handleLogout = () => {
    if (isSsoEnabled()) {
      clearAuthToken();
      clearAuthUser();
      const target = `${window.location.origin}/login`;
      window.location.replace(buildSsoLogoutUrl(target, 'k2s-web'));
      return;
    }

    apiFetch('/api/auth/logout', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        clearAuthToken();
        clearAuthUser();
        navigate('/login');
      });
  };

  return (
    <header className="sticky top-4 z-30 sm:top-6">
      <div className="zoom-performance flex w-full flex-col gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.1)] lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4 dark:border-[#2b4fa7]/85 dark:bg-[#0b1f58]/85 dark:shadow-[0_14px_36px_rgba(3,8,30,0.58)]">
        <div className="flex min-w-0 w-full items-start gap-3 lg:w-auto lg:flex-1 lg:items-center">
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              className="border border-blue-300/80 text-slate-500 transition hover:border-white hover:bg-slate-200/70 hover:text-slate-700 hover:shadow-[0_6px_16px_rgba(15,23,42,0.08)] dark:border-[#4268c4]/80 dark:text-white dark:hover:border-[#9fc0ff] dark:hover:bg-[#1d429f] dark:hover:text-white lg:hidden"
              onClick={onMenuClick}
              aria-label={menuLabel}
              title={menuLabel}
            >
              <MenuLottieIcon isOpen={isSidebarOpen} />
            </Button>
          )}
          {onCollapseToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden border border-blue-300/80 text-slate-500 transition hover:border-white hover:bg-slate-200/70 hover:text-slate-700 hover:shadow-[0_6px_16px_rgba(15,23,42,0.08)] dark:border-[#4268c4]/80 dark:text-white dark:hover:border-[#9fc0ff] dark:hover:bg-[#1d429f] dark:hover:text-white lg:inline-flex"
              onClick={onCollapseToggle}
              aria-label={collapseLabel}
              title={collapseLabel}
            >
              <MenuLottieIcon
                isOpen={
                  typeof isSidebarCollapsed === 'boolean'
                    ? !isSidebarCollapsed
                    : undefined
                }
              />
            </Button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm shadow-slate-500/20 ring-1 ring-slate-200 dark:bg-[#102a72] dark:ring-white/55 dark:shadow-[0_10px_22px_rgba(2,8,30,0.45)]">
              <img
                src="/airnavpp.png"
                alt="AirNav PP"
                className="h-8 w-8 rounded-full object-contain bg-white p-[2px] dark:bg-white dark:brightness-95 dark:contrast-125"
              />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Penyelenggara
              </div>
              <div className="break-words text-sm font-semibold leading-snug text-slate-800 dark:text-blue-50">
                {profileName}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden flex-1 justify-center px-4 lg:flex">
          <div className="relative w-full max-w-md" ref={searchRef}>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="h-10 pl-9"
              placeholder="Cari menu, temuan, atau CAP..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onFocus={() => setIsSearchOpen(true)}
            />
            {isSearchOpen && searchTerm.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-20 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:border-[#2f56ab] dark:bg-[#11307c]/95 dark:shadow-[0_12px_30px_rgba(3,8,28,0.55)]">
                {filteredMenu.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500 dark:text-blue-200/75">
                    Menu tidak ditemukan.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {filteredMenu.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50 dark:text-blue-50 dark:hover:bg-[#1d429f]/75"
                        onClick={() => {
                          if ('externalUrl' in item && item.externalUrl) {
                            window.location.assign(item.externalUrl);
                          } else {
                            navigate(item.path);
                          }
                          setSearchTerm('');
                          setIsSearchOpen(false);
                        }}
                      >
                        <span className="flex-1">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:flex-none lg:justify-end">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 rounded-full border-blue-200/80 bg-white/82 px-3 text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-700 dark:border-[#4268c4]/80 dark:bg-[#1b3f9b]/72 dark:text-blue-100 dark:hover:bg-[#2553be]/78 dark:hover:text-white"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Ganti tema"
            >
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </Button>

            <DropdownMenu open={isPortalOpen} onOpenChange={setIsPortalOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 min-w-0 flex-1 justify-between rounded-full border-blue-200/80 bg-white/82 px-3 text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-700 dark:border-[#4268c4]/80 dark:bg-[#1b3f9b]/72 dark:text-blue-100 dark:hover:bg-[#2553be]/78 dark:hover:text-white lg:flex-none lg:justify-center"
                >
                  Portal
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      isPortalOpen && 'rotate-180'
                    )}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-auto min-w-0 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/70 bg-white/90 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.12)] dark:border-[#2f56ab]/80 dark:bg-[#11307c]/90 dark:shadow-[0_16px_40px_rgba(3,8,28,0.55)]"
              >
                {portalItems.length > 0 ? (
                  <div className={cn('grid justify-items-center gap-3', portalGridClassName)}>
                    {portalItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.key}
                          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-blue-200/70"
                        >
                          <button
                            type="button"
                            className={cn(
                              'flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2',
                              item.buttonClassName,
                              item.ringClassName
                            )}
                            aria-label={item.label}
                            title={item.label}
                            onClick={() => {
                              setIsPortalOpen(false);
                              window.location.assign(item.href);
                            }}
                          >
                            <Icon className="h-5 w-5" />
                          </button>
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-2 py-1 text-xs font-medium text-slate-500 dark:text-blue-200/70">
                    Tidak ada portal yang tersedia.
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu open={isNotifOpen} onOpenChange={setIsNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 rounded-full border border-blue-200/80 bg-white/72 text-slate-500 shadow-sm transition hover:scale-105 hover:bg-white hover:text-slate-900 dark:border-[#4268c4]/80 dark:bg-[#1b3f9b]/70 dark:text-blue-100/80 dark:hover:bg-[#2553be] dark:hover:text-blue-50"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={12}
                className="w-[calc(100vw-2rem)] max-w-[380px] p-0 dark:border-[#2f56ab] dark:bg-[#11307c]"
              >
                <NotificationCenter
                  onClose={() => setIsNotifOpen(false)}
                  onUnreadChange={setUnreadCount}
                />
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-blue-200/80 bg-white/72 text-slate-500 shadow-sm transition hover:scale-105 hover:bg-white hover:text-slate-900 dark:border-[#4268c4]/80 dark:bg-[#1b3f9b]/70 dark:text-blue-100/80 dark:hover:bg-[#2553be] dark:hover:text-blue-50"
                >
                  <UserCircle className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="dark:border-[#2f56ab] dark:bg-[#11307c]"
              >
                <DropdownMenuItem asChild>
                  <Link to="/profile?tab=profile">Setting</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
