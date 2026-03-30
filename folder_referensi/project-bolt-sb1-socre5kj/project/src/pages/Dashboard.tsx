import { Calendar, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';

export default function Dashboard() {
  const recentActivities = [
    { id: 1, category: 'Tower', activity: 'Maintenance Tower A1', time: '2 jam lalu', status: 'Selesai' },
    { id: 2, category: 'App', activity: 'Update aplikasi monitoring', time: '4 jam lalu', status: 'Progress' },
    { id: 3, category: 'Teknik', activity: 'Inspeksi rutin perangkat', time: '5 jam lalu', status: 'Selesai' },
    { id: 4, category: 'Tower', activity: 'Pengecekan sinyal Tower B3', time: '1 hari lalu', status: 'Selesai' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Ringkasan aktivitas logbook hari ini</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Logbook"
          value={156}
          icon={Calendar}
          trend="+12% dari minggu lalu"
        />
        <StatCard
          title="Selesai"
          value={142}
          icon={CheckCircle}
          trend="91% completion rate"
        />
        <StatCard
          title="Dalam Progress"
          value={14}
          icon={Clock}
          trend="9% sedang berjalan"
        />
        <StatCard
          title="Produktivitas"
          value="95%"
          icon={TrendingUp}
          trend="+5% dari bulan lalu"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Aktivitas Terbaru</h2>
          <div className="space-y-3">
            {recentActivities.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-medium">
                      {item.category}
                    </span>
                    <h3 className="text-white font-medium">{item.activity}</h3>
                  </div>
                  <p className="text-gray-400 text-sm">{item.time}</p>
                </div>
                <div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === 'Selesai'
                        ? 'bg-green-500/20 border border-green-400/30 text-green-300'
                        : 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Kategori Logbook</h2>
          <div className="space-y-4">
            {[
              { name: 'Tower', count: 58, color: 'bg-blue-500' },
              { name: 'App', count: 45, color: 'bg-purple-500' },
              { name: 'Teknik', count: 53, color: 'bg-green-500' }
            ].map(category => (
              <div key={category.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300">{category.name}</span>
                  <span className="text-white font-semibold">{category.count}</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${category.color} rounded-full transition-all duration-500`}
                    style={{ width: `${(category.count / 156) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
