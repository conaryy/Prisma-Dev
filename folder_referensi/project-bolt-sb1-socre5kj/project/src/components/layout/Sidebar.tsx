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
      { id: 'tower-logbook', label: 'Logbook Harian', path: '/tower/logbook-harian' },
      { id: 'tower-rekap', label: 'Rekap Logbook', path: '/tower/rekap-logbook' }
    ]
  },
  {
    id: 'app',
    label: 'App',
    icon: 'Smartphone',
    submenu: [
      { id: 'app-logbook', label: 'Logbook Harian', path: '/app/logbook-harian' },
      { id: 'app-rekap', label: 'Rekap Logbook', path: '/app/rekap-logbook' }
    ]
  },
  {
    id: 'teknik',
    label: 'Teknik',
    icon: 'Wrench',
    submenu: [
      { id: 'teknik-logbook', label: 'Logbook Harian', path: '/teknik/logbook-harian' },
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
  return label.includes('Harian') ? BookOpen : BarChart3;
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
          bg-gray-900/40 backdrop-blur-xl border-r border-white/8
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/8">
            <h2 className="text-2xl font-bold text-white">Logbook</h2>
            <p className="text-gray-400 text-sm mt-1">Management System</p>
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
                      bg-white/5 border border-white/8
                      hover:bg-white/10 hover:border-purple-400/30
                      transition-all duration-300 group
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-300 group-hover:text-purple-400 transition-colors" />
                      <span className="text-gray-200 font-medium">{menu.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${
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
                    <div className="space-y-1 ml-4 pl-4 border-l border-white/10">
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
                                  ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300'
                                  : 'bg-white/5 border border-transparent text-gray-300 hover:bg-white/10 hover:border-purple-400/20'
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
