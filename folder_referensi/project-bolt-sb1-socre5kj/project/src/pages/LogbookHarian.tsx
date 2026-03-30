import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import { LogbookEntry } from '../types';

export default function LogbookHarian() {
  const { category } = useParams<{ category: string }>();
  const [searchTerm, setSearchTerm] = useState('');

  const categoryName = category?.charAt(0).toUpperCase() + (category?.slice(1) || '');

  const logbookData: LogbookEntry[] = [
    {
      id: '1',
      date: '2024-03-26',
      time: '08:00',
      activity: 'Pengecekan rutin sistem monitoring',
      category: categoryName,
      status: 'Selesai',
      notes: 'Semua sistem berjalan normal'
    },
    {
      id: '2',
      date: '2024-03-26',
      time: '10:30',
      activity: 'Maintenance perangkat utama',
      category: categoryName,
      status: 'Progress',
      notes: 'Sedang dalam pengerjaan'
    },
    {
      id: '3',
      date: '2024-03-26',
      time: '13:00',
      activity: 'Update dokumentasi teknis',
      category: categoryName,
      status: 'Selesai',
      notes: 'Dokumentasi telah diperbarui'
    },
    {
      id: '4',
      date: '2024-03-25',
      time: '15:45',
      activity: 'Inspeksi keamanan sistem',
      category: categoryName,
      status: 'Selesai',
      notes: 'Tidak ada masalah ditemukan'
    },
    {
      id: '5',
      date: '2024-03-25',
      time: '09:15',
      activity: 'Koordinasi dengan tim lapangan',
      category: categoryName,
      status: 'Selesai',
      notes: 'Meeting berjalan lancar'
    }
  ];

  const filteredData = logbookData.filter(entry =>
    entry.activity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Logbook Harian - {categoryName}</h1>
          <p className="text-gray-400">Catat dan kelola aktivitas harian Anda</p>
        </div>
        <button className="px-6 py-3 bg-purple-500/80 hover:bg-purple-500 border border-purple-400/50 rounded-lg text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 flex items-center gap-2 justify-center">
          <Plus className="w-5 h-5" />
          Tambah Logbook
        </button>
      </div>

      <GlassCard className="p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari aktivitas atau catatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/8 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-400/50 focus:bg-white/10 transition-all duration-300"
            />
          </div>
          <button className="px-4 py-3 bg-white/5 border border-white/8 rounded-lg text-gray-300 hover:bg-white/10 hover:border-purple-400/30 transition-all duration-300 flex items-center gap-2 justify-center">
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Tanggal</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Waktu</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Aktivitas</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Status</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(entry => (
                <tr
                  key={entry.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                >
                  <td className="px-4 py-4 text-gray-300 text-sm">{entry.date}</td>
                  <td className="px-4 py-4 text-gray-300 text-sm">{entry.time}</td>
                  <td className="px-4 py-4 text-white font-medium">{entry.activity}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        entry.status === 'Selesai'
                          ? 'bg-green-500/20 border border-green-400/30 text-green-300'
                          : 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-300'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-sm">{entry.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Tidak ada data yang ditemukan</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
