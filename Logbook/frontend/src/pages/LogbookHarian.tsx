import { useMemo, useState } from 'react';
import { Filter, Plus, Search } from 'lucide-react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import { useLogbookEntries } from '../hooks/useLogbookEntries';
import { getCategoryLabel, isLogbookCategory } from '../lib/logbook';
import type { LogbookCategory } from '../types';

export default function LogbookHarian() {
  const { category } = useParams<{ category: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedCategory = (category ?? '').toLowerCase();
  const activeCategory = (isLogbookCategory(normalizedCategory) ? normalizedCategory : null) as LogbookCategory | null;
  const categoryName = getCategoryLabel(activeCategory ?? category);
  const isTeknik = activeCategory === 'teknik';
  const { entries, isLoading, error } = useLogbookEntries(activeCategory, 500);

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return entries;
    }

    return entries.filter((entry) => entry.searchText.includes(query));
  }, [entries, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Logbook - {categoryName}</h1>
          <p className="text-gray-400">Data logbook hasil import yang tersimpan di database</p>
        </div>
        <button className="px-6 py-3 bg-purple-500/80 border border-purple-400/50 rounded-lg text-white font-medium opacity-70 flex items-center gap-2 justify-center cursor-not-allowed">
          <Plus className="w-5 h-5" />
          Import Excel Segera
        </button>
      </div>

      <GlassCard className="p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={
                isTeknik
                  ? 'Cari peralatan, freq, atau kejadian...'
                  : 'Cari operation type, facility, call sign, atau keterangan...'
              }
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-violet-300/25 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-violet-300/50 focus:bg-white/10 transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 bg-white/5 border border-violet-300/25 rounded-lg text-gray-300 opacity-70 flex items-center gap-2 justify-center cursor-not-allowed">
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-violet-300/18">
                {isTeknik ? (
                  <>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">NO</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">TANGGAL</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">JAM</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Peralatan</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Freq / Bagian</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Kejadian</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">No.</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Tanggal</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Jam</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Operation Type</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Facility</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Call Sign</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Keterangan</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) =>
                isTeknik ? (
                  <tr key={entry.id} className="border-b border-violet-300/10 hover:bg-white/5 transition-colors duration-200">
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryNo}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.dateLabel}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryTime}</td>
                    <td className="px-4 py-4 text-white font-medium">{entry.title}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.subtitle}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.description}</td>
                  </tr>
                ) : (
                  <tr key={entry.id} className="border-b border-violet-300/10 hover:bg-white/5 transition-colors duration-200">
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryNo}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.dateLabel}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryTime}</td>
                    <td className="px-4 py-4 text-white font-medium">{entry.title}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.subtitle}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">
                      {'callSign' in entry.detail ? entry.detail.callSign : '-'}
                    </td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.description}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {!activeCategory && (
          <div className="text-center py-12">
            <p className="text-gray-400">Kategori logbook tidak dikenali.</p>
          </div>
        )}

        {activeCategory && filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">{isLoading ? 'Memuat data logbook...' : 'Tidak ada data yang ditemukan'}</p>
            {error && !isLoading && <p className="text-sm text-red-300 mt-2">{error}</p>}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
