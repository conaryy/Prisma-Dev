import { Video as LucideIcon } from 'lucide-react';
import GlassCard from './GlassCard';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
}

export default function StatCard({ title, value, icon: Icon, trend }: StatCardProps) {
  return (
    <GlassCard hover className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {trend && <p className="text-purple-400 text-sm mt-2">{trend}</p>}
        </div>
        <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-400/30">
          <Icon className="w-8 h-8 text-purple-400" />
        </div>
      </div>
    </GlassCard>
  );
}
