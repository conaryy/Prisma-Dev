import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  UserCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { clearAuthToken, clearAuthUser } from '@/lib/api';
import { getStoredTheme, persistTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import dashboardImage from '../../../dashboard.png';
import logbookImage from '../../../logbook.jpg';
import safetyImage from '../../../safety.jpg';
import secImage from '../../../sec-image.jpg';

type PortalMenu = {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  eyebrow: string;
  meta: string;
  badgeClass: string;
  iconClass: string;
  lineClass: string;
  dotClass: string;
  actionClass: string;
  actionBgClass: string;
  backgroundImageSrc?: string;
  accentColor: string;
  accentBorder: string;
};

const portalMenus: PortalMenu[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    description: 'Ringkasan operasional admin untuk memantau review, antrian, dan prioritas tindak lanjut.',
    href: '/admin',
    icon: LayoutDashboard,
    eyebrow: 'Kontrol Utama',
    meta: 'Insight admin dan prioritas harian',
    badgeClass: 'bg-[rgba(239,246,255,0.96)] text-[#1d4ed8]',
    iconClass: 'bg-[rgba(219,234,254,0.96)] text-[#2563eb]',
    lineClass: 'bg-blue-500',
    dotClass: 'bg-blue-500',
    actionClass: 'text-[#64748b] group-hover:text-white',
    actionBgClass: 'group-hover:bg-blue-500',
    backgroundImageSrc: dashboardImage,
    accentColor: '#3b82f6',
    accentBorder: 'rgba(59,130,246,0.5)',
  },
  {
    key: 'keamanan',
    title: 'Keamanan',
    description: 'Akses cepat ke data keamanan dan pemantauan umum dengan struktur yang tetap familiar.',
    href: '/dashboard',
    icon: ShieldCheck,
    eyebrow: 'Monitoring',
    meta: 'Pemantauan umum dan data operasional',
    badgeClass: 'bg-[rgba(236,254,255,0.96)] text-[#0f7490]',
    iconClass: 'bg-[rgba(207,250,254,0.96)] text-[#0891b2]',
    lineClass: 'bg-cyan-500',
    dotClass: 'bg-cyan-500',
    actionClass: 'text-[#64748b] group-hover:text-white',
    actionBgClass: 'group-hover:bg-cyan-500',
    backgroundImageSrc: secImage,
    accentColor: '#06b6d4',
    accentBorder: 'rgba(6,182,212,0.5)',
  },
  {
    key: 'k3',
    title: 'K3',
    description: 'Area kerja review safety, CAP, dan monitoring K3 dengan jalur masuk yang lebih jelas.',
    href: '/admin/self-assessment-reviews',
    icon: ClipboardCheck,
    eyebrow: 'Review Safety',
    meta: 'Safety review, CAP, dan tindak lanjut',
    badgeClass: 'bg-[rgba(236,253,245,0.96)] text-[#047857]',
    iconClass: 'bg-[rgba(209,250,229,0.96)] text-[#059669]',
    lineClass: 'bg-emerald-500',
    dotClass: 'bg-emerald-500',
    actionClass: 'text-[#64748b] group-hover:text-white',
    actionBgClass: 'group-hover:bg-emerald-500',
    backgroundImageSrc: safetyImage,
    accentColor: '#10b981',
    accentBorder: 'rgba(16,185,129,0.5)',
  },
  {
    key: 'logbook',
    title: 'Logbook',
    description: 'Portal pencatatan dan hasil review aktivitas logbook dengan alur yang lebih rapi.',
    href: '/monitoring/protocol-question/hasil-review-dgca',
    icon: BookOpen,
    eyebrow: 'Riwayat Aktivitas',
    meta: 'Pencatatan dan review agenda monitoring',
    badgeClass: 'bg-[rgba(245,243,255,0.96)] text-[#7c3aed]',
    iconClass: 'bg-[rgba(237,233,254,0.96)] text-[#7c3aed]',
    lineClass: 'bg-violet-500',
    dotClass: 'bg-violet-500',
    actionClass: 'text-[#64748b] group-hover:text-white',
    actionBgClass: 'group-hover:bg-violet-500',
    backgroundImageSrc: logbookImage,
    accentColor: '#8b5cf6',
    accentBorder: 'rgba(139,92,246,0.5)',
  },
];

export function AdminPortal() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => getStoredTheme() === 'dark');

  useEffect(() => {
    const html = document.documentElement;
    const check = () => setIsDark(html.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    clearAuthUser();
    navigate('/login', { replace: true });
  };

  const handleThemeToggle = () => {
    const nextIsDark = !isDark;
    persistTheme(nextIsDark ? 'dark' : 'light');
    setIsDark(nextIsDark);
  };

  const userActionButtonStyle = isDark
    ? {
        borderColor: '#1e3a6e',
        backgroundColor: 'rgba(12,22,52,0.95)',
        color: '#94a3b8',
      }
    : {
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        color: '#475569',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: isDark ? 'transparent' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header>
          <div
            className="flex items-center justify-between gap-4 rounded-[28px] border px-4 py-3 sm:px-5"
            style={isDark ? {
              borderColor: '#1e3a6e',
              backgroundColor: 'rgba(8,16,42,0.88)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            } : {
              borderColor: '#e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                style={isDark ? {
                  borderColor: '#1e3a6e',
                  backgroundColor: 'rgba(12,22,52,0.95)',
                } : {
                  borderColor: '#e2e8f0',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <img
                  src="/airnavpp.png"
                  alt="Airnav Indonesia"
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                >
                  Admin Access
                </p>
                <div
                  className="truncate text-sm font-semibold sm:text-base"
                  style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                >
                  Unit KKS Cabang Surabaya
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleThemeToggle}
                aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                title={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                className="gap-2 rounded-2xl border-white/80 bg-white/70 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-700 dark:border-[#4268c4]/80 dark:bg-[#1b3f9b]/70 dark:text-blue-100 dark:hover:bg-[#2553be]/75 dark:hover:text-white"
              >
                {isDark ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                {isDark ? 'Dark' : 'Light'}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Menu akun"
                    title="Menu akun"
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                    style={userActionButtonStyle}
                  >
                    <UserCircle className="h-6 w-6" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="min-w-[160px]">
                  <DropdownMenuItem
                    onSelect={(event: Event) => {
                      event.preventDefault();
                      handleLogout();
                    }}
                    className="cursor-pointer gap-2 font-semibold text-red-600 focus:text-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto mt-16 w-full max-w-[1520px] sm:mt-20 lg:mt-24">
          <section className="grid gap-3 md:grid-cols-2">
            {portalMenus.map((item, index) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className="group relative overflow-hidden rounded-[22px] border p-4 transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                  style={isDark ? {
                    borderColor: item.accentBorder,
                    borderLeftWidth: '3px',
                    borderLeftColor: item.accentColor,
                    backgroundColor: 'rgba(8,16,42,0.82)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: `0 0 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
                  } : {
                    borderColor: '#e2e8f0',
                    backgroundColor: 'rgba(255,255,255,0.98)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {item.backgroundImageSrc ? (
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-focus-visible:opacity-100">
                      <div
                        className="absolute inset-y-0 right-0 w-[54%] translate-x-4 scale-[1.03] bg-cover bg-center transition-transform duration-500 ease-out group-hover:translate-x-0 group-hover:scale-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100"
                        style={{
                          backgroundImage: `url(${item.backgroundImageSrc})`,
                          opacity: isDark ? 0.2 : 0.3,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 w-[54%]"
                        style={isDark ? {
                          background: 'linear-gradient(90deg, rgba(8,16,42,0.99) 0%, rgba(8,16,42,0.9) 16%, rgba(8,16,42,0.62) 38%, rgba(8,16,42,0.28) 68%, rgba(8,16,42,0.16) 100%)',
                        } : {
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.99) 0%, rgba(255,255,255,0.96) 16%, rgba(255,255,255,0.6) 38%, rgba(255,255,255,0.26) 68%, rgba(255,255,255,0.14) 100%)',
                        }}
                      />
                      <div
                        className="absolute inset-y-[12%] w-28 -translate-x-1/2 rounded-full blur-2xl"
                        style={isDark ? {
                          left: '46%',
                          background: 'linear-gradient(90deg, rgba(138,181,255,0.16) 0%, rgba(8,16,42,0.22) 55%, rgba(8,16,42,0) 100%)',
                        } : {
                          left: '46%',
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.36) 55%, rgba(255,255,255,0) 100%)',
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="relative z-10">
                    <div className={`h-1.5 w-12 rounded-full ${item.lineClass}`} />

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] ${isDark ? '' : item.badgeClass}`}
                          style={isDark ? {
                            backgroundColor: `${item.accentColor}22`,
                            color: item.accentColor,
                          } : undefined}
                        >
                          {item.eyebrow}
                        </span>
                        <div
                          className="text-xs font-medium"
                          style={{ color: isDark ? '#475569' : '#94a3b8' }}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </div>
                      </div>

                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-2xl ${isDark ? '' : item.iconClass}`}
                        style={isDark ? {
                          backgroundColor: `${item.accentColor}30`,
                          color: item.accentColor,
                        } : undefined}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <h2
                        className="text-2xl font-semibold tracking-tight"
                        style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                      >
                        {item.title}
                      </h2>
                      <p
                        className="text-[13px] leading-5"
                        style={{ color: isDark ? '#94a3b8' : '#475569' }}
                      >
                        {item.description}
                      </p>
                    </div>

                    <div
                      className="mt-3 flex items-center gap-2 text-[13px]"
                      style={{ color: isDark ? '#64748b' : '#64748b' }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.accentColor }}
                      />
                      {item.meta}
                    </div>

                    <div className="mt-4 -mb-4 -ml-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-r-full pl-5 pr-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${item.actionClass} ${item.actionBgClass}`}
                      >
                        Masuk
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        </main>
      </div>
    </div>
  );
}
