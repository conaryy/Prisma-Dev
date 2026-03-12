import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { Topbar } from './Topbar';
import { LoadingState } from '@/components/states/LoadingState';

export function AdminLayout() {
  return (
    <div className="relative min-h-screen bg-[#f5f6ff] text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="zoom-blobs absolute -top-40 right-[-120px] h-96 w-96 rounded-full bg-blue-200/50" />
        <div className="zoom-blobs absolute bottom-0 left-[-80px] h-80 w-80 rounded-full bg-sky-200/40" />
      </div>

      <AdminSidebar />

      <div className="transition-[padding] duration-300 ease-in-out lg:pl-[18rem]">
        <div className="w-full px-3 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-10">
          <Topbar />
          <div className="zoom-performance relative mt-4 overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 sm:mt-6 sm:rounded-[28px] sm:p-6 lg:p-8">
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-500 opacity-90 sm:h-24" />
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
