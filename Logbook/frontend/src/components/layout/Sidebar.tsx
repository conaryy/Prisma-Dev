import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  Radio,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { MenuItem } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems: MenuItem[] = [
  {
    id: 'tower',
    label: 'Tower',
    icon: 'Radio',
    submenu: [
      { id: 'tower-logbook', label: 'Logbook', path: '/tower/logbook-harian' },
      { id: 'tower-rekap', label: 'Rekap Logbook', path: '/tower/rekap-logbook' }
    ]
  },
  {
    id: 'app',
    label: 'App',
    icon: 'Smartphone',
    submenu: [
      { id: 'app-logbook', label: 'Logbook', path: '/app/logbook-harian' },
      { id: 'app-rekap', label: 'Rekap Logbook', path: '/app/rekap-logbook' }
    ]
  },
  {
    id: 'teknik',
    label: 'Teknik',
    icon: 'Wrench',
    submenu: [
      { id: 'teknik-logbook', label: 'Logbook', path: '/teknik/logbook-harian' },
      { id: 'teknik-rekap', label: 'Rekap Logbook', path: '/teknik/rekap-logbook' }
    ]
  }
];

const getIcon = (iconName: string) => {
  const icons: Record<string, typeof Radio> = {
    Radio,
    Smartphone,
    Wrench
  };
  return icons[iconName] || Radio;
};

const getSubmenuIcon = (label: string) => {
  return label.includes('Rekap') ? BarChart3 : BookOpen;
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeMenuFromPath = useMemo(
    () => menuItems.find((menu) => location.pathname.startsWith(`/${menu.id}`))?.id ?? 'tower',
    [location.pathname]
  );
  const [activeMenuId, setActiveMenuId] = useState(activeMenuFromPath);

  useEffect(() => {
    setActiveMenuId(activeMenuFromPath);
  }, [activeMenuFromPath]);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const activeMenu = menuItems.find((menu) => menu.id === activeMenuId) ?? menuItems[0];

  const accentStyles: Record<string, string> = {
    tower: 'from-cyan-400/24 via-sky-400/12 to-transparent border-cyan-300/18 text-cyan-100',
    app: 'from-emerald-400/24 via-teal-400/12 to-transparent border-emerald-300/18 text-emerald-100',
    teknik: 'from-amber-400/24 via-orange-400/12 to-transparent border-amber-300/18 text-amber-100',
  };

  const iconAccentStyles: Record<string, string> = {
    tower: 'text-cyan-200 shadow-[0_10px_30px_rgba(34,211,238,0.16)]',
    app: 'text-emerald-200 shadow-[0_10px_30px_rgba(52,211,153,0.16)]',
    teknik: 'text-amber-200 shadow-[0_10px_30px_rgba(251,191,36,0.16)]',
  };

  const railIconShellStyles: Record<string, string> = {
    tower: 'bg-violet-900/30 border-violet-300/25',
    app: 'bg-violet-900/30 border-violet-300/25',
    teknik: 'bg-violet-900/30 border-violet-300/25',
  };

  const railIconColorStyles: Record<string, string> = {
    tower: 'text-cyan-300',
    app: 'text-emerald-300',
    teknik: 'text-amber-300',
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      <aside
        className={`
          fixed top-2 left-2 bottom-2 z-50
          flex w-[calc(100vw-1rem)] max-w-[22rem] flex-col overflow-hidden rounded-[1.75rem]
          border backdrop-blur-xl
          transition-transform duration-300 ease-in-out
          lg:top-0 lg:left-0 lg:bottom-0 lg:w-[18rem] lg:max-w-none lg:flex-row lg:rounded-none lg:border-y-0 lg:border-l-0
          ${isOpen ? 'translate-x-0' : '-translate-x-[110%] lg:-translate-x-full'}
        `}
        style={{
          background: 'var(--sidebar-shell)',
          borderColor: 'var(--border-soft)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div
          className="flex shrink-0 flex-col border-b lg:h-full lg:w-[5.5rem] lg:border-b-0 lg:border-r"
          style={{ background: 'var(--sidebar-rail)', borderColor: 'var(--border-soft)' }}
        >
          <div className="flex h-20 items-center justify-between px-4 lg:h-24 lg:justify-center lg:px-0">
            <div className="flex items-center gap-3 lg:hidden">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                style={{
                  background: 'var(--sidebar-logo-bg)',
                  borderColor: 'var(--sidebar-logo-border)',
                  boxShadow: 'var(--sidebar-logo-shadow)',
                }}
              >
                <img src="/airnavpp.png" alt="AirNav" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Logbook</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Quick navigation</p>
              </div>
            </div>
            <div
              className="hidden h-12 w-12 items-center justify-center rounded-2xl border lg:flex"
              style={{
                background: 'var(--sidebar-logo-bg)',
                borderColor: 'var(--sidebar-logo-border)',
                boxShadow: 'var(--sidebar-logo-shadow)',
              }}
            >
              <img src="/airnavpp.png" alt="AirNav" className="h-7 w-7 object-contain" />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border lg:hidden"
              style={{
                background: 'var(--surface-soft)',
                borderColor: 'var(--border-soft)',
                color: 'var(--text-secondary)',
              }}
              aria-label="Tutup sidebar"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
          </div>

          <nav className="flex gap-3 overflow-x-auto px-4 pb-4 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:px-3 lg:py-5">
            {menuItems.map((menu) => {
              const Icon = getIcon(menu.icon || '');
              const isActive = menu.id === activeMenu.id;

              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => setActiveMenuId(menu.id)}
                  title={menu.label}
                  className={`group flex min-w-[5.5rem] flex-1 items-center justify-center rounded-2xl border px-0 py-3 transition-all duration-300 lg:min-w-0 lg:flex-none lg:py-4 ${
                    isActive
                      ? `${iconAccentStyles[menu.id]}`
                      : 'border-transparent'
                  }`}
                  style={{
                    background: isActive
                      ? 'var(--sidebar-rail-item-active-bg)'
                      : 'var(--sidebar-rail-item-bg)',
                    borderColor: isActive
                      ? 'var(--sidebar-rail-item-active-border)'
                      : 'transparent',
                    color: 'var(--sidebar-rail-item-text)',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 ${
                        isActive
                          ? railIconShellStyles[menu.id]
                          : 'border-transparent bg-transparent'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isActive ? railIconColorStyles[menu.id] : ''
                        }`}
                      />
                    </div>
                    <span
                      className="text-[11px] font-medium tracking-[0.04em]"
                      style={{
                        color: isActive
                          ? 'var(--sidebar-rail-item-active-text)'
                          : 'var(--sidebar-rail-item-text)',
                      }}
                    >
                      {menu.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="hidden border-t border-violet-200/10 px-3 py-4 lg:block">
            <button
              type="button"
              onClick={() => handleNavigation('/')}
              className={`flex w-full items-center justify-center rounded-2xl border px-0 py-3 transition-all duration-300 ${
                location.pathname === '/'
                  ? 'border-violet-300/22 bg-violet-500/16 text-violet-100'
                  : 'border-transparent'
              }`}
              style={
                location.pathname === '/'
                  ? undefined
                  : {
                      background: 'var(--surface-soft)',
                      color: 'var(--text-muted)',
                    }
              }
              title="Dashboard"
            >
              <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col" style={{ background: 'var(--sidebar-panel)' }}>
          <div className="border-b px-4 py-4 lg:px-5 lg:py-5" style={{ borderColor: 'var(--border-soft)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>
                  Navigation
                </p>
                <h2 className="mt-2 text-xl font-semibold lg:text-2xl" style={{ color: 'var(--text-primary)' }}>Logbook</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Perum LPPNPI Cabang Surabaya</p>
              </div>
              <div
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${accentStyles[activeMenu.id]}`}
                style={{
                  background: 'var(--sidebar-chip-bg)',
                  borderColor: 'var(--sidebar-chip-border)',
                  color: 'var(--sidebar-chip-text)',
                }}
              >
                {activeMenu.label}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 lg:py-5">
            <div className={`rounded-3xl border bg-gradient-to-br p-4 ${accentStyles[activeMenu.id]}`}>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${iconAccentStyles[activeMenu.id]}`}
                  style={{
                    background: 'rgba(88, 28, 135, 0.30)',
                    borderColor: 'rgba(196, 181, 253, 0.25)',
                  }}
                >
                  {(() => {
                    const ActiveIcon = getIcon(activeMenu.icon || '');
                    return <ActiveIcon className="h-5 w-5" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold" style={{ color: 'var(--sidebar-active-title)' }}>
                    {activeMenu.label}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--sidebar-active-text)' }}>
                    Pilih tampilan logbook yang ingin dibuka
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => handleNavigation('/')}
                className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-300 lg:hidden"
                style={
                  location.pathname === '/'
                    ? {
                        background: 'var(--sidebar-item-active-bg)',
                        borderColor: 'var(--sidebar-item-active-border)',
                        color: 'var(--sidebar-item-active-text)',
                        boxShadow: 'var(--sidebar-item-active-shadow)',
                      }
                    : {
                        background: 'var(--surface-soft)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      background:
                        location.pathname === '/'
                          ? 'var(--sidebar-item-active-icon-bg)'
                          : 'var(--surface-strong)',
                      color:
                        location.pathname === '/'
                          ? 'var(--sidebar-item-active-icon)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Dashboard</div>
                    <div
                      className="text-xs"
                      style={{
                        color:
                          location.pathname === '/'
                            ? 'var(--sidebar-item-active-muted)'
                            : 'var(--text-muted)',
                      }}
                    >
                      Kembali ke ringkasan utama
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0"
                  style={{
                    color:
                      location.pathname === '/'
                        ? 'var(--sidebar-item-active-icon)'
                        : 'var(--text-muted)',
                  }}
                />
              </button>

              {activeMenu.submenu?.map((submenu) => {
                const SubIcon = getSubmenuIcon(submenu.label);
                const isActive = location.pathname === submenu.path;

                return (
                  <button
                    key={submenu.id}
                    type="button"
                    onClick={() => handleNavigation(submenu.path)}
                    className="group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-300"
                    style={
                      isActive
                        ? {
                            background: 'var(--sidebar-item-active-bg)',
                            borderColor: 'var(--sidebar-item-active-border)',
                            color: 'var(--sidebar-item-active-text)',
                            boxShadow: 'var(--sidebar-item-active-shadow)',
                          }
                        : {
                            background: 'var(--surface-soft)',
                            borderColor: 'var(--border-soft)',
                            color: 'var(--text-secondary)',
                          }
                    }
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={isActive ? { background: 'var(--sidebar-item-active-icon-bg)' } : undefined}
                      >
                        <SubIcon
                          className="h-4 w-4"
                          style={isActive ? { color: 'var(--sidebar-item-active-icon)' } : { color: 'var(--text-muted)' }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{submenu.label}</div>
                        <div
                          className="truncate text-xs"
                          style={{ color: isActive ? 'var(--sidebar-item-active-muted)' : 'var(--text-muted)' }}
                        >
                          {submenu.label.includes('Rekap') ? 'Ringkasan dan distribusi data' : 'Data harian hasil import'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isActive ? '' : 'group-hover:translate-x-0.5'}`}
                      style={isActive ? { color: 'var(--sidebar-item-active-icon)' } : { color: 'var(--text-muted)' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
