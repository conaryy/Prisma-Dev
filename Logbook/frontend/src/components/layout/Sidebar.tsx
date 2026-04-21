import { BarChart3, ChevronDown, ChevronRight, FileSearch, Home, Radio, Smartphone, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type NavLink = {
  label: string;
  path: string;
  icon: typeof Home;
};

type NavGroup = {
  id: string;
  label: string;
  icon: typeof Home;
  color: string;
  activeBackground: string;
  links: NavLink[];
};

const primaryLinks: NavLink[] = [
  { label: 'Dashboard', path: '/', icon: Home },
];

const bottomLinks: NavLink[] = [
  { label: 'Import Center', path: '/import-management', icon: FileSearch },
];

const navGroups: NavGroup[] = [
  {
    id: 'tower',
    label: 'Tower',
    icon: Radio,
    color: '#06b6d4',
    activeBackground: 'rgba(6, 182, 212, 0.10)',
    links: [
      { label: 'Logbook Harian', path: '/tower/logbook-harian', icon: FileSearch },
      { label: 'Rekap Logbook', path: '/tower/rekap-logbook', icon: BarChart3 },
    ],
  },
  {
    id: 'app',
    label: 'App',
    icon: Smartphone,
    color: '#10b981',
    activeBackground: 'rgba(16, 185, 129, 0.10)',
    links: [
      { label: 'Logbook Harian', path: '/app/logbook-harian', icon: FileSearch },
      { label: 'Rekap Logbook', path: '/app/rekap-logbook', icon: BarChart3 },
    ],
  },
  {
    id: 'teknik',
    label: 'Teknik',
    icon: Wrench,
    color: '#f59e0b',
    activeBackground: 'rgba(245, 158, 11, 0.12)',
    links: [
      { label: 'Logbook Harian', path: '/teknik/logbook-harian', icon: FileSearch },
      { label: 'Rekap Logbook', path: '/teknik/rekap-logbook', icon: BarChart3 },
    ],
  },
];

function isPathActive(pathname: string, path: string) {
  if (path === '/') {
    return pathname === '/';
  }

  return pathname === path;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeGroupId = useMemo(
    () => navGroups.find((group) => location.pathname.startsWith(`/${group.id}/`))?.id ?? null,
    [location.pathname]
  );
  const [openGroupId, setOpenGroupId] = useState<string | null>(activeGroupId);

  useEffect(() => {
    if (activeGroupId) {
      setOpenGroupId(activeGroupId);
    }
  }, [activeGroupId]);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const renderLink = (link: NavLink) => {
    const Icon = link.icon;
    const isActive = isPathActive(location.pathname, link.path);

    return (
      <button
        key={link.path}
        type="button"
        onClick={() => handleNavigation(link.path)}
        className="group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition"
        style={
          isActive
            ? {
                background: 'var(--sidebar-item-active-bg)',
                borderColor: 'var(--sidebar-item-active-border)',
                color: 'var(--sidebar-item-active-text)',
              }
            : {
                background: 'transparent',
                borderColor: 'transparent',
                color: 'var(--text-secondary)',
              }
        }
      >
        <Icon
          className="h-4 w-4 shrink-0"
          style={{ color: isActive ? 'var(--sidebar-item-active-icon)' : 'var(--text-muted)' }}
        />
        <span className="min-w-0 flex-1 truncate">{link.label}</span>
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-label="Tutup sidebar"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen w-[17rem] max-w-[calc(100vw-2rem)] flex-col border-r
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'var(--sidebar-shell)',
          borderColor: 'var(--border-soft)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: 'var(--border-soft)' }}>
          <button
            type="button"
            onClick={() => handleNavigation('/')}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{
                background: 'var(--sidebar-logo-bg)',
                borderColor: 'var(--sidebar-logo-border)',
                boxShadow: 'var(--sidebar-logo-shadow)',
              }}
            >
              <img src="/airnavpp.png" alt="AirNav" className="h-7 w-7 object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Logbook
              </span>
              <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                AirNav Surabaya
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden"
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

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          <div className="space-y-1">{primaryLinks.map(renderLink)}</div>

          <div className="space-y-4">
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = activeGroupId === group.id;
              const isExpanded = openGroupId === group.id;

              return (
                <section key={group.id} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenGroupId((current) => (current === group.id ? null : group.id))}
                    className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold uppercase transition"
                    style={{
                      background: isGroupActive || isExpanded ? group.activeBackground : 'transparent',
                      borderColor: isGroupActive || isExpanded ? `${group.color}33` : 'transparent',
                      color: isGroupActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                    aria-expanded={isExpanded}
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" style={{ color: group.color }} />
                    <span className="min-w-0 flex-1 truncate">{group.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      style={{ color: isGroupActive ? group.color : 'var(--text-muted)' }}
                    />
                  </button>
                  {isExpanded ? (
                    <div className="space-y-1 pl-3">{group.links.map(renderLink)}</div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 px-3 py-4">
          <div className="space-y-1">{bottomLinks.map(renderLink)}</div>
        </div>
      </aside>
    </>
  );
}
