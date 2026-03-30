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
  const { entries, isLoading, error } = useLogbookEntries(activeCategory, 1000);

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
          <h1 className="text-3xl font-bold text-white mb-2">Rekap Logbook - {categoryName}</h1>
          <p className="text-gray-400">Ringkasan data logbook berdasarkan hasil import dan periode terpilih</p>
        </div>
        <button className="px-6 py-3 bg-white/5 border border-violet-300/25 rounded-lg text-white font-medium opacity-70 flex items-center gap-2 justify-center cursor-not-allowed">
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
                ? 'bg-purple-500/80 border border-purple-400/50 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white/5 border border-violet-300/25 text-gray-300 hover:bg-white/10 hover:border-violet-300/40'
            }`}
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
        <h2 className="text-xl font-semibold text-white mb-6">Rekap Per Kategori Aktivitas</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-violet-300/18">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Kategori</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Jumlah</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Persentase</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Distribusi</th>
              </tr>
            </thead>
            <tbody>
              {groupedData.map((item) => {
                const percentage = totalLogbook > 0 ? Math.round((item.total / totalLogbook) * 100) : 0;
                return (
                  <tr key={item.label} className="border-b border-violet-300/10 hover:bg-white/5 transition-colors duration-200">
                    <td className="px-4 py-4 text-white font-medium">{item.label}</td>
                    <td className="px-4 py-4 text-center text-gray-300">{item.total}</td>
                    <td className="px-4 py-4 text-center text-white font-semibold">{percentage}%</td>
                    <td className="px-4 py-4">
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
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
          <p className="mt-6 text-sm text-gray-400">
            {isLoading ? 'Memuat rekap logbook...' : error ?? 'Belum ada data pada periode yang dipilih.'}
          </p>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Catatan Rekap</h2>
          <div className="space-y-4 text-sm text-gray-300">
            <p>Rekap dihitung dari entry yang sudah masuk ke database, bukan langsung dari file Excel arsip.</p>
            <p>Untuk kategori `{categoryName}`, grouping saat ini memakai judul utama entry seperti `operationType` atau `equipment`.</p>
            <p>Saat semantic search ditambahkan, rekap bisa diperluas menjadi grouping berbasis konteks, bukan hanya teks mentah.</p>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Distribusi Periode</h2>
          <div className="space-y-6 pt-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Entry Periode Ini
                </span>
                <span className="text-white font-semibold">{totalLogbook}</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${entries.length > 0 ? (totalLogbook / entries.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Di Luar Periode
                </span>
                <span className="text-white font-semibold">{Math.max(entries.length - totalLogbook, 0)}</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
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
