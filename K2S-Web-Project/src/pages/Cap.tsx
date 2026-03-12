import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/shared/DataTable';
import { toast } from '@/hooks/use-toast';
import { isOverdue } from '@/lib/date';
import {
  fetchSelfAssessmentCapList,
  fetchSelfAssessmentCapSessionsAll,
} from '@/lib/selfAssessment';

const STATUS_OPTIONS = [
  { label: 'Semua', value: 'Semua' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
];

interface CapRow {
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

interface CapSessionRow {
  id: string;
  rowNumber: number;
  sessionAreaId: string;
  scope: string;
  area: string;
  leader: string;
  totalFindings: number;
}

export function Cap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<CapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionRows, setSessionRows] = useState<CapSessionRow[]>([]);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  const statusFilter = searchParams.get('status') ?? 'Semua';
  const overdueOnly = searchParams.get('overdue') === '1';

  useEffect(() => {
    setIsLoading(true);
    fetchSelfAssessmentCapList()
      .then((data) => {
        setItems(data);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (statusFilter !== 'open') return;
    setIsSessionLoading(true);
    fetchSelfAssessmentCapSessionsAll()
      .then((data) => {
        const mapped = data
          .filter((item) => item.sessionAreaId && (item.notSatisfactoryCount ?? 0) > 0)
          .map((item, index) => ({
            id: item.sessionAreaId,
            rowNumber: index + 1,
            sessionAreaId: item.sessionAreaId,
            scope: item.scope,
            area: item.area,
            leader: item.leader,
            totalFindings: item.notSatisfactoryCount ?? 0,
          }));
        setSessionRows(mapped);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSessionLoading(false));
  }, [statusFilter]);

  const filteredCaps = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'Semua') {
        const isOpen = !item.isClosed;
        if (statusFilter === 'open' && !isOpen) return false;
        if (statusFilter === 'closed' && isOpen) return false;
      }
      if (overdueOnly) {
        if (!item.targetDate || item.isClosed) return false;
        if (!isOverdue(item.targetDate)) return false;
      }
      return true;
    });
  }, [items, statusFilter, overdueOnly]);

  const updateStatusFilter = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value === 'Semua') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', value);
    }
    setSearchParams(nextParams);
  };

  const toggleOverdue = (checked: boolean) => {
    const nextParams = new URLSearchParams(searchParams);
    if (checked) {
      nextParams.set('overdue', '1');
    } else {
      nextParams.delete('overdue');
    }
    setSearchParams(nextParams);
  };

  const resetFilters = () => {
    setSearchParams({});
  };

  const formatScope = (value: string) => {
    const normalized = value?.toLowerCase();
    if (normalized === 'audit') return 'Audit';
    if (normalized === 'inspeksi') return 'Inspeksi';
    if (normalized === 'surveillance') return 'Surveillance';
    if (normalized === 'monitoring') return 'Monitoring';
    return value || '-';
  };

  const formatCategory = (row: CapRow) => {
    const prefix = row.questionCategoryPrefix?.trim();
    const name = row.questionCategory?.trim();
    if (prefix && name) return `${prefix} - ${name}`;
    if (name) return name;
    if (row.questionText) return row.questionText;
    return row.questionCode ?? '-';
  };

  const openCapSource = (row: CapSessionRow) => {
    const scope = row.scope?.toLowerCase();
    const scopePath =
      scope === 'audit'
        ? 'audit'
        : scope === 'inspeksi'
        ? 'inspeksi'
        : scope === 'surveillance'
        ? 'surveillance'
        : null;

    if (!scopePath) {
      toast({
        title: 'Scope belum tersedia',
        description: 'Menu pemenuhan CAP untuk scope ini belum tersedia.',
      });
      return;
    }

    navigate(`/${scopePath}/cap/pemenuhan/${row.sessionAreaId}`);
  };

  const openSource = (row: CapRow) => {
    const scope = row.scope?.toLowerCase();
    const scopePath =
      scope === 'audit'
        ? 'audit'
        : scope === 'inspeksi'
        ? 'inspeksi'
        : scope === 'surveillance'
        ? 'surveillance'
        : null;

    if (!scopePath || !row.sessionAreaId) {
      toast({
        title: 'Scope belum tersedia',
        description: 'Pemenuhan CAP untuk scope ini belum tersedia.',
      });
      return;
    }

    navigate(
      `/${scopePath}/cap/pemenuhan/${row.sessionAreaId}?answerId=${row.answerId}`
    );
  };

  const openCapTable = statusFilter === 'open';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Database Pengawasan
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Tindak Lanjut (CAP)
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Daftar tindak lanjut dari seluruh temuan.
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
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/55 dark:text-slate-200">
            <Checkbox
              checked={overdueOnly}
              onCheckedChange={(checked) => toggleOverdue(checked === true)}
            />
            Overdue saja
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            disabled={statusFilter === 'Semua' && !overdueOnly}
          >
            Reset Filter
          </Button>
        </div>
      </div>

      {openCapTable ? (
        <DataTable
          data={sessionRows}
          isLoading={isSessionLoading}
          emptyState="Belum ada CAP terbuka."
          columns={[
            {
              header: 'No',
              render: (row) => row.rowNumber,
            },
            {
              header: 'Scope',
              render: (row) => formatScope(row.scope),
            },
            {
              header: 'Area',
              render: (row) => row.area || '-',
            },
            {
              header: 'Total Temuan',
              render: (row) => row.totalFindings,
            },
            { header: 'PIC', render: (row) => row.leader ?? '-' },
            {
              header: 'Aksi',
              render: (row) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCapSource(row)}
                >
                  Buka Sumber
                </Button>
              ),
            },
          ]}
        />
      ) : (
        <DataTable
          data={filteredCaps}
          isLoading={isLoading}
          emptyState="Belum ada temuan CAP."
          columns={[
            {
              header: 'Scope',
              render: (row) => formatScope(row.scope),
            },
            {
              header: 'Area',
              render: (row) => row.area || '-',
            },
            {
              header: 'Kategori',
              render: (row) => formatCategory(row),
            },
            { header: 'PIC', render: (row) => row.leader ?? '-' },
            {
              header: 'Aksi',
              render: (row) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSource(row)}
                >
                  Buka Sumber
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
