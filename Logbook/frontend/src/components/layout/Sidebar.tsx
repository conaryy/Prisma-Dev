import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Radio, Smartphone, Wrench, ChevronDown, BookOpen, BarChart3 } from 'lucide-react';
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
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['tower']);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuId) ? prev.filter(id => id !== menuId) : [...prev, menuId]
    );
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      onClose();
    }
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
          fixed top-0 left-0 h-full w-64 z-50
          bg-[#241f43] border-r border-violet-200/14 shadow-[18px_0_50px_rgba(10,10,22,0.58)]
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="border-b border-violet-200/14 bg-black/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-200/18 bg-[#2a2346] shadow-[0_8px_24px_rgba(18,15,34,0.44)]">
                <img src="/airnavpp.png" alt="AirNav" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">Logbook</h2>
                <p className="mt-0.5 text-sm text-slate-400">Management System</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {menuItems.map(menu => {
              const Icon = getIcon(menu.icon || '');
              const isExpanded = expandedMenus.includes(menu.id);

              return (
                <div key={menu.id}>
                  <button
                    onClick={() => toggleMenu(menu.id)}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 rounded-lg
                      bg-white/[0.035] border border-violet-200/12
                      hover:bg-white/[0.06] hover:border-violet-200/22
                      transition-all duration-300 group
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-violet-100/85 group-hover:text-violet-100 transition-colors" />
                      <span className="font-medium text-slate-200">{menu.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div
                    className={`
                      overflow-hidden transition-all duration-300
                      ${isExpanded ? 'max-h-40 mt-2' : 'max-h-0'}
                    `}
                  >
                    <div className="ml-4 space-y-1 border-l border-violet-200/14 pl-4">
                      {menu.submenu?.map(submenu => {
                        const SubIcon = getSubmenuIcon(submenu.label);
                        const isActive = location.pathname === submenu.path;

                        return (
                          <button
                            key={submenu.id}
                            onClick={() => handleNavigation(submenu.path)}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2.5 rounded-lg
                              transition-all duration-300
                              ${
                                isActive
                                  ? 'bg-[#4f3a92]/24 border border-violet-300/30 text-violet-100 shadow-[0_10px_30px_rgba(35,29,68,0.32)]'
                                  : 'bg-white/[0.03] border border-violet-200/10 text-slate-200 hover:bg-white/[0.06] hover:border-violet-200/24'
                              }
                            `}
                          >
                            <SubIcon className="w-4 h-4" />
                            <span className="text-sm">{submenu.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
