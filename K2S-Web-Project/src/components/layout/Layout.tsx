import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { LoadingState } from '@/components/states/LoadingState';
import { cn } from '@/lib/utils';

export function Layout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    let scrollTimer = 0;

    const onScroll = () => {
      if (!root.dataset.scrolling) {
        root.dataset.scrolling = 'true';
      }
      if (scrollTimer) {
        window.clearTimeout(scrollTimer);
      }
      scrollTimer = window.setTimeout(() => {
        root.removeAttribute('data-scrolling');
        scrollTimer = 0;
      }, 160);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, true);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, true);
      if (scrollTimer) {
        window.clearTimeout(scrollTimer);
      }
    };
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="relative min-h-screen bg-[#f3f6ff] text-slate-900 transition-colors duration-300 dark:bg-[#040714] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="zoom-blobs absolute -top-40 right-[-120px] h-96 w-96 rounded-full bg-blue-200/50 dark:bg-[#9fc0ff]/34" />
        <div className="zoom-blobs absolute bottom-0 left-[-80px] h-80 w-80 rounded-full bg-sky-200/40 dark:bg-[#2553be]/42" />
        <div className="zoom-blobs absolute top-1/3 left-1/3 h-72 w-72 rounded-full bg-emerald-200/25 dark:bg-[#3e74ea]/30" />
      </div>

      <Sidebar
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onExpandRequest={() => setIsSidebarCollapsed(false)}
      />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          'transition-[padding] duration-300 ease-in-out lg:pl-[18rem]',
          isSidebarCollapsed && 'lg:pl-20'
        )}
      >
        <div className="w-full px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-10">
          <Topbar
            onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
            onCollapseToggle={() => setIsSidebarCollapsed((prev) => !prev)}
            isSidebarOpen={isSidebarOpen}
            isSidebarCollapsed={isSidebarCollapsed}
          />

          <div className="zoom-performance relative mt-4 overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-colors duration-300 sm:mt-6 sm:rounded-[28px] sm:p-6 lg:p-8 dark:border-[#2f57af]/70 dark:bg-[#102b74]/82 dark:shadow-[0_20px_56px_rgba(2,8,28,0.62)]">
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-500 opacity-90 sm:h-24 dark:from-[#234cae] dark:via-[#3f72e8] dark:to-[#8ab8ff]" />

            <div className="relative pt-8">
              <Suspense fallback={<LoadingState message="Memuat halaman..." />}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
