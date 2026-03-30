import { Calendar, Database, Radio, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import { useLogbookOverview } from '../hooks/useLogbookEntries';
import { getCategoryLabel } from '../lib/logbook';

export default function Dashboard() {
  const { overview, isLoading, error } = useLogbookOverview();
  const totalEntries = overview?.totalEntries ?? 0;
  const categoryCount = overview?.summaries.filter((item) => item.total > 0).length ?? 0;
  const recentEntries = overview?.allEntries.slice(0, 6) ?? [];
  const latestEntry = recentEntries[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Ringkasan data logbook yang sudah diimpor ke database</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Total Logbook" value={isLoading ? '...' : totalEntries} icon={Calendar} trend="Seluruh kategori" />
        <StatCard title="Kategori Aktif" value={isLoading ? '...' : categoryCount} icon={Radio} trend="Tower, App, Teknik" />
        <StatCard
          title="Entry Terbaru"
          value={latestEntry?.entryTime ?? '-'}
          icon={Database}
          trend={latestEntry ? `${latestEntry.dateLabel} • ${getCategoryLabel(latestEntry.category)}` : 'Belum ada data'}
        />
        <StatCard
          title="Status Data"
          value={error ? 'Error' : isLoading ? 'Loading' : 'Ready'}
          icon={TrendingUp}
          trend={error ?? 'Siap dipakai untuk pencarian dan analisis'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-white">Entry Terbaru</h2>
            <Link to="/tower/logbook-harian" className="text-sm text-violet-300 hover:text-violet-200 transition-colors">
              Buka logbook
            </Link>
          </div>
          {error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : recentEntries.length === 0 ? (
            <p className="text-sm text-gray-400">
              {isLoading ? 'Memuat ringkasan logbook...' : 'Belum ada data logbook di database.'}
            </p>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg bg-white/5 border border-violet-300/22 hover:bg-white/10 hover:border-violet-300/35 transition-all duration-300"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-medium">
                        {getCategoryLabel(item.category)}
                      </span>
                      <h3 className="truncate text-white font-medium">{item.title}</h3>
                    </div>
                    <p className="text-gray-400 text-sm truncate">{item.description || item.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-white">{item.entryTime}</p>
                    <p className="text-xs text-gray-400">{item.dateLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Distribusi Kategori</h2>
          {overview?.summaries.length ? (
            <div className="space-y-4">
              {overview.summaries.map((category) => (
                <div key={category.category}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">{category.label}</span>
                    <span className="text-white font-semibold">{category.total}</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${totalEntries > 0 ? (category.total / totalEntries) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{isLoading ? 'Memuat distribusi kategori...' : 'Belum ada data kategori.'}</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
