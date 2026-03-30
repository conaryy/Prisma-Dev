import { Bell, User } from 'lucide-react';
import BurgerButton from '../ui/BurgerButton';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Topbar({ isSidebarOpen, onToggleSidebar }: TopbarProps) {
  return (
    <div className="fixed top-0 right-0 left-0 lg:left-64 z-40 transition-all duration-300">
      <div className="bg-white/5 backdrop-blur-md border-b border-white/8 h-16 px-4 lg:px-6">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-4">
            <BurgerButton isOpen={isSidebarOpen} onClick={onToggleSidebar} />
            <h1 className="text-xl font-semibold text-white hidden sm:block">Logbook Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 hover:border-purple-400/30 transition-all duration-300">
              <Bell className="w-5 h-5 text-gray-300" />
            </button>
            <button className="p-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 hover:border-purple-400/30 transition-all duration-300">
              <User className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
