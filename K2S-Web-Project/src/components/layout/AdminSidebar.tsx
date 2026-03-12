import { Link, useLocation } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, LayoutDashboard, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const linkBase =
  'group relative flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:focus-visible:ring-slate-500/50';
const linkActive =
  'bg-white text-slate-900 shadow-[0_12px_30px_rgba(59,130,246,0.18)] ring-1 ring-blue-100 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:shadow-[0_12px_30px_rgba(2,6,23,0.55)] dark:ring-slate-700 dark:before:bg-slate-300';
const linkIdle =
  'text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

export function AdminSidebar() {
  const location = useLocation();
  const navItem = (href: string) => location.pathname === href;
  const navClass = (active: boolean) =>
    cn(linkBase, active ? linkActive : linkIdle);

  return (
    <aside className="zoom-performance fixed left-0 top-0 z-40 h-screen w-72 overflow-hidden rounded-r-[32px] border-r border-white/60 bg-white transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-white/70 bg-gradient-to-b from-white via-white to-blue-50/80 px-6 py-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
            Admin Panel
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            KKS Terpadu
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5 text-slate-700 dark:text-slate-300">
          <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
            Menu Admin
          </div>
          <Link to="/admin" className={navClass(navItem('/admin'))}>
            <LayoutDashboard className="h-4 w-4" />
            <span className="flex-1">Dashboard</span>
          </Link>
          <Link to="/admin/users" className={navClass(navItem('/admin/users'))}>
            <Users className="h-4 w-4" />
            <span className="flex-1">Kelola User</span>
          </Link>
          <Link
            to="/admin/self-assessment"
            className={navClass(navItem('/admin/self-assessment'))}
          >
            <ClipboardList className="h-4 w-4" />
            <span className="flex-1">Pertanyaan Self Assessment</span>
          </Link>
          <Link
            to="/admin/monitoring-reviews"
            className={navClass(navItem('/admin/monitoring-reviews'))}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="flex-1">Review Monitoring</span>
          </Link>
          <Link
            to="/admin/self-assessment-reviews"
            className={navClass(navItem('/admin/self-assessment-reviews'))}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="flex-1">Review Unit Safety</span>
          </Link>
        </nav>
      </div>
    </aside>
  );
}
