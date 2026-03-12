import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/lib/date';

const SURVEILLANCE_DATA = [
  {
    id: 'surv-1',
    date: '2026-01-08',
    location: 'Terminal Approach',
    status: 'Aktif',
    note: 'Pemantauan prosedur navigasi.',
  },
  {
    id: 'surv-2',
    date: '2026-01-03',
    location: 'Tower Control',
    status: 'Selesai',
    note: 'Surveillance shift malam.',
  },
];

export function Surveillance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Surveillance</h1>
        <p className="text-sm text-slate-500">
          Halaman placeholder untuk konsistensi menu.
        </p>
      </div>

      <DataTable
        data={SURVEILLANCE_DATA}
        columns={[
          { header: 'Tanggal', render: (item) => formatDate(item.date) },
          { header: 'Lokasi', render: (item) => item.location },
          { header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
          { header: 'Catatan', render: (item) => item.note },
        ]}
      />
    </div>
  );
}
