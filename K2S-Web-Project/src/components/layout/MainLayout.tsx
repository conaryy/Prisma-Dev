import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('scrollbar-gutter-stable');

    return () => {
      root.classList.remove('scrollbar-gutter-stable');
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-transparent">
      <Sidebar isOpen={isSidebarOpen} />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <Topbar
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />

        <main className="container mx-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
