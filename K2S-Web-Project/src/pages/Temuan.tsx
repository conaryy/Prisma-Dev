import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { fetchSelfAssessmentCapList } from '@/lib/selfAssessment';

const STATUS_OPTIONS = ['Semua', 'Open', 'Closed'];

interface TemuanCapRow {
  id: string;
  answerId: string;
  sessionAreaId: string | null;
  scope: string;
  area: string;
  questionCode: string | null;
  questionText: string;
  questionCategory: string | null;
  questionCategoryPrefix: string | null;
  leader: string | null;
  targetDate: string | null;
  isClosed: boolean;
}

export function Temuan() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<TemuanCapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const statusFilter = searchParams.get('status') ?? 'Semua';

  useEffect(() => {
    setIsLoading(true);
    fetchSelfAssessmentCapList()
      .then((data) => setItems(data))
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data temuan',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'Semua') return true;
      const status = item.isClosed ? 'Closed' : 'Open';
      return status === statusFilter;
    });
  }, [items, statusFilter]);

  const formatScope = (value: string) => {
    const normalized = value?.toLowerCase();
    if (normalized === 'audit') return 'Audit';
    if (normalized === 'inspeksi') return 'Inspeksi';
    if (normalized === 'surveillance') return 'Surveillance';
    if (normalized === 'monitoring') return 'Monitoring';
    return value || '-';
  };

  const formatCategory = (item: TemuanCapRow) => {
    const prefix = item.questionCategoryPrefix?.trim();
    const name = item.questionCategory?.trim();
    if (prefix && name) return `${prefix} - ${name}`;
    if (name) return name;
    return item.questionCode ?? '-';
  };

  const updateStatusFilter = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === 'Semua') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', value);
    }
    setSearchParams(nextParams);
  };

  const resetFilters = () => {
    setSearchParams({});
  };

  const openSource = (item: TemuanCapRow) => {
    const scope = item.scope?.toLowerCase();
    const scopePath =
      scope === 'audit'
        ? 'audit'
        : scope === 'inspeksi'
        ? 'inspeksi'
        : scope === 'surveillance'
        ? 'surveillance'
        : null;

    if (!scopePath || !item.sessionAreaId) {
      toast({
        title: 'Scope belum tersedia',
        description: 'Pemenuhan CAP untuk scope ini belum tersedia.',
      });
      return;
    }

    navigate(`/${scopePath}/cap/pemenuhan/${item.sessionAreaId}?answerId=${item.answerId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Database Pengawasan
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Daftar Temuan
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Temuan lintas audit, inspeksi, dan monitoring.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
              Status
            </div>
            <select
              className="h-10 rounded-xl border border-input bg-white/80 px-3 text-sm text-slate-700 shadow-sm backdrop-blur-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700/80 dark:bg-slate-900/55 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/50"
              value={statusFilter}
              onChange={(event) => updateStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            disabled={statusFilter === 'Semua'}
          >
            Reset Filter
          </Button>
        </div>
      </div>

      <DataTable
        data={filteredItems}
        isLoading={isLoading}
        emptyState="Belum ada temuan."
        columns={[
          { header: 'Scope', render: (item) => formatScope(item.scope) },
          { header: 'Area', render: (item) => item.area || '-' },
          { header: 'Kategori', render: (item) => formatCategory(item) },
          { header: 'Deskripsi', render: (item) => item.questionText || '-' },
          { header: 'PIC', render: (item) => item.leader ?? '-' },
          { header: 'Status', render: (item) => <StatusBadge status={item.isClosed ? 'Closed' : 'Open'} /> },
          {
            header: 'Aksi',
            render: (item) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSource(item)}
              >
                Buka Sumber
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
