import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  Open: 'border-red-200/80 bg-red-50 text-red-600 shadow-red-200/40',
  'In Progress': 'border-amber-200/80 bg-amber-50 text-amber-600 shadow-amber-200/40',
  Closed: 'border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-emerald-200/40',
  Done: 'border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-emerald-200/40',
  Selesai: 'border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-emerald-200/40',
  Direncanakan: 'border-blue-200/80 bg-blue-50 text-blue-600 shadow-blue-200/40',
  Berjalan: 'border-amber-200/80 bg-amber-50 text-amber-600 shadow-amber-200/40',
  Draft: 'border-slate-200/80 bg-slate-50 text-slate-600 shadow-slate-200/40 dark:text-slate-800',
  Dikirim: 'border-sky-200/80 bg-sky-50 text-sky-600 shadow-sky-200/40 dark:text-sky-900',
  'Allow Reply': 'border-violet-200/80 bg-violet-50 text-violet-600 shadow-violet-200/40',
  Aktif: 'border-teal-200/80 bg-teal-50 text-teal-600 shadow-teal-200/40',
  Low: 'border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-emerald-200/40',
  Med: 'border-amber-200/80 bg-amber-50 text-amber-600 shadow-amber-200/40',
  High: 'border-red-200/80 bg-red-50 text-red-600 shadow-red-200/40',
  Satisfactory: 'border-blue-200/80 bg-blue-50 text-blue-600 shadow-blue-200/40',
  'Not Satisfactory': 'border-red-200/80 bg-red-50 text-red-600 shadow-red-200/40',
  'Not Aplicable': 'border-pink-200/80 bg-pink-50 text-pink-600 shadow-pink-200/40',
  'Not Applicable': 'border-pink-200/80 bg-pink-50 text-pink-600 shadow-pink-200/40',
  Final: 'border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-emerald-200/40',
  Interim: 'border-amber-200/80 bg-amber-50 text-amber-600 shadow-amber-200/40',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-sm',
        STATUS_STYLES[status]
      )}
    >
      {status}
    </Badge>
  );
}
