import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Download, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import { RekapData } from '../types';

export default function RekapLogbook() {
  const { category } = useParams<{ category: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState('minggu');

  const categoryName = category?.charAt(0).toUpperCase() + (category?.slice(1) || '');

  const rekapData: RekapData[] = [
    { category: 'Maintenance', total: 45, completed: 42, pending: 3 },
    { category: 'Inspeksi', total: 32, completed: 30, pending: 2 },
    { category: 'Update Sistem', total: 18, completed: 15, pending: 3 },
    { category: 'Koordinasi', total: 25, completed: 24, pending: 1 },
    { category: 'Dokumentasi', total: 36, completed: 31, pending: 5 }
  ];

  const totalLogbook = rekapData.reduce((sum, item) => sum + item.total, 0);
  const totalCompleted = rekapData.reduce((sum, item) => sum + item.completed, 0);
  const totalPending = rekapData.reduce((sum, item) => sum + item.pending, 0);
  const completionRate = Math.round((totalCompleted / totalLogbook) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Rekap Logbook - {categoryName}</h1>
          <p className="text-gray-400">Ringkasan dan analisis aktivitas logbook</p>
        </div>
        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/8 hover:border-purple-400/30 rounded-lg text-white font-medium transition-all duration-300 flex items-center gap-2 justify-center">
          <Download className="w-5 h-5" />
          Export Data
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['hari', 'minggu', 'bulan', 'tahun'].map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap ${
              selectedPeriod === period
                ? 'bg-purple-500/80 border border-purple-400/50 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white/5 border border-white/8 text-gray-300 hover:bg-white/10 hover:border-purple-400/30'
            }`}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)} Ini
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Aktivitas"
          value={totalLogbook}
          icon={Calendar}
          trend={`Periode: ${selectedPeriod} ini`}
        />
        <StatCard
          title="Selesai"
          value={totalCompleted}
          icon={CheckCircle}
          trend={`${completionRate}% completion`}
        />
        <StatCard
          title="Dalam Progress"
          value={totalPending}
          icon={Clock}
          trend={`${100 - completionRate}% berlangsung`}
        />
        <StatCard
          title="Produktivitas"
          value={`${completionRate}%`}
          icon={TrendingUp}
          trend="Performa sangat baik"
        />
      </div>

      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Rekap Per Kategori Aktivitas</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Kategori</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Total</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Selesai</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Progress</th>
                <th className="px-4 py-3 text-center text-gray-400 font-medium">Persentase</th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">Progress Bar</th>
              </tr>
            </thead>
            <tbody>
              {rekapData.map((item, index) => {
                const percentage = Math.round((item.completed / item.total) * 100);
                return (
                  <tr
                    key={index}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200"
                  >
                    <td className="px-4 py-4 text-white font-medium">{item.category}</td>
                    <td className="px-4 py-4 text-center text-gray-300">{item.total}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-3 py-1 rounded-full bg-green-500/20 border border-green-400/30 text-green-300 text-sm font-medium">
                        {item.completed}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/30 text-yellow-300 text-sm font-medium">
                        {item.pending}
                      </span>
                    </td>
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
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Tren Produktivitas</h2>
          <div className="h-64 flex items-end justify-around gap-2">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, index) => {
              const height = Math.random() * 80 + 20;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-white/5 rounded-t-lg relative group">
                    <div
                      className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t-lg transition-all duration-500 hover:from-purple-400 hover:to-purple-300"
                      style={{ height: `${height}px` }}
                    ></div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {Math.round(height)}%
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">{day}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Distribusi Status</h2>
          <div className="space-y-6 pt-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Selesai
                </span>
                <span className="text-white font-semibold">{totalCompleted}</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Dalam Progress
                </span>
                <span className="text-white font-semibold">{totalPending}</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                  style={{ width: `${(totalPending / totalLogbook) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
