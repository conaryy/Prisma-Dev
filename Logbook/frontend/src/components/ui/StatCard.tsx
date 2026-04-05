import type { LucideIcon } from 'lucide-react';
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
          <p className="mb-1 text-sm" style={{ color: 'var(--text-muted)' }}>{title}</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          {trend && <p className="mt-2 text-sm" style={{ color: 'var(--accent)' }}>{trend}</p>}
        </div>
        <div
          className="rounded-lg border p-3"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--border-soft)' }}
        >
          <Icon className="h-8 w-8" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
    </GlassCard>
  );
}
