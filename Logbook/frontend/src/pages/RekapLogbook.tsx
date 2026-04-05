import { useMemo, useState } from 'react';
import { Calendar, Clock, Database, Download, TrendingUp } from 'lucide-react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import { useLogbookEntries } from '../hooks/useLogbookEntries';
import { getCategoryLabel, getPeriodStart, groupEntriesForRekap, isLogbookCategory } from '../lib/logbook';
import type { LogbookCategory } from '../types';

export default function RekapLogbook() {
  const { category } = useParams<{ category: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<'hari' | 'minggu' | 'bulan' | 'tahun'>('minggu');
  const normalizedCategory = (category ?? '').toLowerCase();
  const activeCategory = (isLogbookCategory(normalizedCategory) ? normalizedCategory : null) as LogbookCategory | null;
  const categoryName = getCategoryLabel(activeCategory ?? category);
  const { entries, isLoading, error } = useLogbookEntries({
    category: activeCategory,
    page: 1,
    pageSize: 100,
  });

  const periodStart = useMemo(() => getPeriodStart(selectedPeriod), [selectedPeriod]);
  const filteredEntries = useMemo(
    () => entries.filter((entry) => entry.sortDate >= periodStart),
    [entries, periodStart]
  );
  const groupedData = useMemo(() => groupEntriesForRekap(filteredEntries), [filteredEntries]);
  const totalLogbook = filteredEntries.length;
  const totalGroups = groupedData.length;
  const averagePerGroup = totalGroups > 0 ? Math.round(totalLogbook / totalGroups) : 0;
  const latestEntry = filteredEntries[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="theme-page-title mb-2 text-3xl font-bold">Rekap Logbook - {categoryName}</h1>
          <p className="theme-page-subtitle">Ringkasan data logbook berdasarkan hasil import dan periode terpilih</p>
        </div>
        <button
          className="theme-soft-panel flex cursor-not-allowed items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Download className="w-5 h-5" />
          Export Menyusul
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['hari', 'minggu', 'bulan', 'tahun'] as const).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap ${
              selectedPeriod === period
                ? 'theme-primary-button shadow-lg'
                : 'theme-soft-panel'
            }`}
            style={selectedPeriod === period ? undefined : { color: 'var(--text-secondary)' }}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)} Ini
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard title="Total Aktivitas" value={isLoading ? '...' : totalLogbook} icon={Calendar} trend={`Periode: ${selectedPeriod} ini`} />
        <StatCard title="Kelompok Aktivitas" value={isLoading ? '...' : totalGroups} icon={Database} trend="Dikelompokkan dari judul entry" />
        <StatCard title="Rata-rata per Kelompok" value={isLoading ? '...' : averagePerGroup} icon={Clock} trend="Kepadatan data per kategori" />
        <StatCard
          title="Entry Terbaru"
          value={latestEntry?.entryTime ?? '-'}
          icon={TrendingUp}
          trend={latestEntry ? latestEntry.dateLabel : error ?? 'Belum ada data pada periode ini'}
        />
      </div>

      <GlassCard className="p-6">
        <h2 className="mb-6 text-xl font-semibold theme-page-title">Rekap Per Kategori Aktivitas</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-violet-300/18">
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Kategori</th>
                <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-muted)' }}>Jumlah</th>
                <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-muted)' }}>Persentase</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Distribusi</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((item) => {
                const percentage = totalLogbook > 0 ? Math.round((item.total / totalLogbook) * 100) : 0;
                return (
                  <tr key={item.label} className="theme-data-row transition-colors duration-200">
                    <td className="px-4 py-4 font-medium theme-page-title">{item.label}</td>
                    <td className="px-4 py-4 text-center" style={{ color: 'var(--text-secondary)' }}>{item.total}</td>
                    <td className="px-4 py-4 text-center font-semibold theme-page-title">{percentage}%</td>
                    <td className="px-4 py-4">
                      <div className="theme-progress-track h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!groupedData.length && (
          <p className="theme-page-subtitle mt-6 text-sm">
            {isLoading ? 'Memuat rekap logbook...' : error ?? 'Belum ada data pada periode yang dipilih.'}
          </p>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h2 className="mb-4 text-xl font-semibold theme-page-title">Catatan Rekap</h2>
          <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <p>Rekap dihitung dari entry yang sudah masuk ke database, bukan langsung dari file Excel arsip.</p>
            <p>Untuk kategori `{categoryName}`, grouping saat ini memakai judul utama entry seperti `operationType` atau `equipment`.</p>
            <p>Saat semantic search ditambahkan, rekap bisa diperluas menjadi grouping berbasis konteks, bukan hanya teks mentah.</p>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="mb-4 text-xl font-semibold theme-page-title">Distribusi Periode</h2>
          <div className="space-y-6 pt-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Entry Periode Ini
                </span>
                <span className="font-semibold theme-page-title">{totalLogbook}</span>
              </div>
              <div className="theme-progress-track h-3 w-full overflow-hidden rounded-full">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${entries.length > 0 ? (totalLogbook / entries.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Di Luar Periode
                </span>
                <span className="font-semibold theme-page-title">{Math.max(entries.length - totalLogbook, 0)}</span>
              </div>
              <div className="theme-progress-track h-3 w-full overflow-hidden rounded-full">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                  style={{ width: `${entries.length > 0 ? ((entries.length - totalLogbook) / entries.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
