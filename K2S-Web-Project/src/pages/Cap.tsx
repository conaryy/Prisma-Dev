import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/shared/DataTable';
import { toast } from '@/hooks/use-toast';
import { isOverdue } from '@/lib/date';
import {
  fetchExternalDnpDashboardCapList,
  type ExternalDnpDashboardCapItem,
} from '@/lib/externalDnp';
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
  capId?: string | null;
  answerId: string;
  sessionAreaId: string | null;
  scope: string;
  instansiName?: string | null;
  area: string;
  questionCode: string | null;
  questionText: string;
  questionCategory: string | null;
  questionCategoryPrefix: string | null;
  leader: string | null;
  targetDate: string | null;
  effectiveDeadline?: string | null;
  hasCap: boolean;
  isClosed: boolean;
  isOverdue: boolean;
  statusLabel: string;
  latestProgress?: number | null;
  latestFulfillmentStatus?: string | null;
}

interface CapSessionRow {
  id: string;
  rowNumber: number;
  sessionAreaId: string;
  scope: string;
  instansiName?: string | null;
  area: string;
  leader: string;
  totalFindings: number;
  openCapCount: number;
  overdueCapCount: number;
}

const normalizeCapStatusLabel = (statusLabel: string | null | undefined, isClosed: boolean) => {
  if (isClosed) return 'Closed';
  if (!statusLabel) return 'Open';

  return statusLabel.toLowerCase() === 'overdue' ? 'Open' : statusLabel;
};

const isCapClosed = (item: Pick<CapRow, 'hasCap' | 'isClosed' | 'latestProgress'>) => {
  if (!item.hasCap) return false;
  if (typeof item.latestProgress === 'number') {
    return item.latestProgress >= 100;
  }

  return item.isClosed;
};

const isCapOpen = (item: Pick<CapRow, 'hasCap' | 'isClosed' | 'latestProgress'>) =>
  item.hasCap && !isCapClosed(item);

export function Cap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<CapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionRows, setSessionRows] = useState<CapSessionRow[]>([]);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  const dataSource = searchParams.get('source') ?? 'internal';
  const isExternalDnpSource = dataSource === 'external-dnp';
  const statusFilter = searchParams.get('status') ?? 'Semua';
  const overdueOnly = searchParams.get('overdue') === '1';

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const load = async () => {
      try {
        if (isExternalDnpSource) {
          const data = await fetchExternalDnpDashboardCapList();
          if (cancelled) return;
          setItems(
            data.map((item: ExternalDnpDashboardCapItem) => {
              const latestProgress = item.latestProgress ?? null;
              const isClosed = item.hasCap && typeof latestProgress === 'number'
                ? latestProgress >= 100
                : item.isClosed;

              return {
                id: item.id,
                capId: item.capId ?? null,
                answerId: item.answerId,
                sessionAreaId: item.sessionAreaId,
                scope: item.scope,
                instansiName: item.instansiName ?? null,
                area: item.area,
                questionCode: item.questionCode,
                questionText: item.questionText,
                questionCategory: item.questionCategory ?? null,
                questionCategoryPrefix: null,
                leader: item.leader ?? null,
                targetDate: item.targetDate ?? null,
                effectiveDeadline: item.effectiveDeadline ?? item.targetDate ?? null,
                hasCap: item.hasCap,
                isClosed,
                isOverdue: item.isOverdue,
                statusLabel: normalizeCapStatusLabel(item.statusLabel, isClosed),
                latestProgress,
                latestFulfillmentStatus: item.latestFulfillmentStatus ?? null,
              };
            })
          );
          return;
        }

        const data = await fetchSelfAssessmentCapList();
        if (cancelled) return;
        setItems(
          data.map((item) => {
            const isItemOverdue = !!item.targetDate && !item.isClosed && isOverdue(item.targetDate);

            return {
              ...item,
              capId: item.id,
              instansiName: null,
              effectiveDeadline: item.targetDate,
              hasCap: true,
              isOverdue: isItemOverdue,
              statusLabel: normalizeCapStatusLabel(undefined, item.isClosed),
              latestProgress: null,
              latestFulfillmentStatus: null,
            };
          })
        );
      } catch (error) {
        if (cancelled) return;
        toast({
          title: 'Gagal memuat data CAP',
          description: error instanceof Error ? error.message || 'Terjadi kesalahan.' : 'Terjadi kesalahan.',
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isExternalDnpSource]);

  useEffect(() => {
    if (isExternalDnpSource || statusFilter !== 'open') return;
    let cancelled = false;
    setIsSessionLoading(true);
    fetchSelfAssessmentCapSessionsAll()
      .then((data) => {
        if (cancelled) return;
        const mapped = data
          .filter((item) => item.sessionAreaId && (item.notSatisfactoryCount ?? 0) > 0)
          .map((item, index) => ({
            id: item.sessionAreaId,
            rowNumber: index + 1,
            sessionAreaId: item.sessionAreaId,
            scope: item.scope,
            instansiName: null,
            area: item.area,
            leader: item.leader,
            totalFindings: item.notSatisfactoryCount ?? 0,
            openCapCount: item.notSatisfactoryCount ?? 0,
            overdueCapCount: 0,
          }));
        setSessionRows(mapped);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        toast({
          title: 'Gagal memuat data CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsSessionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isExternalDnpSource, statusFilter]);

  const externalSessionRows = useMemo(() => {
    if (!isExternalDnpSource) return [];

    const grouped = new Map<string, Omit<CapSessionRow, 'rowNumber'>>();
    items.forEach((item) => {
      if (!item.sessionAreaId) return;

      const existing = grouped.get(item.sessionAreaId) ?? {
        id: item.sessionAreaId,
        sessionAreaId: item.sessionAreaId,
        scope: item.scope,
        instansiName: item.instansiName ?? null,
        area: item.area,
        leader: item.leader ?? '-',
        totalFindings: 0,
        openCapCount: 0,
        overdueCapCount: 0,
      };

      existing.totalFindings += 1;
      if (isCapOpen(item)) {
        existing.openCapCount += 1;
      }
      if (item.isOverdue && isCapOpen(item)) {
        existing.overdueCapCount += 1;
      }

      grouped.set(item.sessionAreaId, existing);
    });

    return Array.from(grouped.values())
      .filter((row) => row.openCapCount > 0)
      .filter((row) => !overdueOnly || row.overdueCapCount > 0)
      .sort((left, right) => {
        if (left.scope !== right.scope) {
          return left.scope.localeCompare(right.scope);
        }
        return `${left.instansiName ?? ''} ${left.area}`.localeCompare(
          `${right.instansiName ?? ''} ${right.area}`
        );
      })
      .map((row, index) => ({
        ...row,
        rowNumber: index + 1,
      }));
  }, [isExternalDnpSource, items, overdueOnly]);

  const filteredCaps = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'Semua') {
        const isOpen = isCapOpen(item);
        const isClosed = isCapClosed(item);
        if (statusFilter === 'open' && !isOpen) return false;
        if (statusFilter === 'closed' && !isClosed) return false;
      }
      if (overdueOnly) {
        const deadline = item.effectiveDeadline ?? item.targetDate;
        if (!deadline || isCapClosed(item)) return false;
        if (!isOverdue(deadline)) return false;
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
    const nextParams = new URLSearchParams();
    if (searchParams.get('source')) {
      nextParams.set('source', searchParams.get('source') ?? '');
    }
    setSearchParams(nextParams);
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

  const formatDeadline = (row: CapRow) => {
    const deadline = row.effectiveDeadline ?? row.targetDate;
    if (!deadline) return '-';
    if (row.targetDate && row.effectiveDeadline && row.targetDate !== row.effectiveDeadline) {
      return `${deadline} (ext)`;
    }
    return deadline;
  };

  const buildScopePath = (value: string) => {
    const normalized = value?.toLowerCase();
    if (normalized === 'audit') return 'audit';
    if (normalized === 'inspeksi') return 'inspeksi';
    if (normalized === 'surveillance') return 'surveillance';
    return null;
  };

  const renderStatusBadge = (row: CapRow) => {
    const status = row.statusLabel;
    const className =
      status === 'Closed'
        ? 'border border-emerald-200/80 bg-emerald-100 text-emerald-700 shadow-sm dark:border-emerald-900/80 dark:bg-emerald-950/80 dark:text-emerald-200 dark:shadow-none'
        : status === 'Open'
        ? 'border border-sky-200/80 bg-sky-100 text-sky-700 shadow-sm dark:border-sky-900/80 dark:bg-sky-950/80 dark:text-sky-200 dark:shadow-none'
        : 'border border-amber-200/80 bg-amber-100 text-amber-700 shadow-sm dark:border-amber-900/80 dark:bg-amber-950/80 dark:text-amber-200 dark:shadow-none';

    return (
      <div className="space-y-1">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
          {status}
        </span>
        {row.hasCap && row.latestProgress !== null && (
          <div className="text-[11px] text-slate-500 dark:text-slate-300">
            Progress {row.latestProgress}%
          </div>
        )}
      </div>
    );
  };

  const openCapSource = (row: CapSessionRow) => {
    const scopePath = buildScopePath(row.scope);

    if (!scopePath) {
      toast({
        title: 'Scope belum tersedia',
        description: 'Menu pemenuhan CAP untuk scope ini belum tersedia.',
      });
      return;
    }

    navigate(
      isExternalDnpSource
        ? `/external-dnp/${scopePath}/cap/pemenuhan/${row.sessionAreaId}`
        : `/${scopePath}/cap/pemenuhan/${row.sessionAreaId}`
    );
  };

  const openSource = (row: CapRow) => {
    const scopePath = buildScopePath(row.scope);

    if (!scopePath || !row.sessionAreaId) {
      toast({
        title: 'Scope belum tersedia',
        description: 'Pemenuhan CAP untuk scope ini belum tersedia.',
      });
      return;
    }

    if (isExternalDnpSource) {
      const mode = row.hasCap ? 'pemenuhan' : 'penyusunan';
      navigate(
        `/external-dnp/${scopePath}/cap/${mode}/${row.sessionAreaId}?answerId=${row.answerId}`
      );
      return;
    }

    navigate(
      `/${scopePath}/cap/pemenuhan/${row.sessionAreaId}?answerId=${row.answerId}`
    );
  };

  const openCapTable = statusFilter === 'open';
  const displaySessionRows = isExternalDnpSource ? externalSessionRows : sessionRows;
  const sessionTableLoading = isExternalDnpSource ? isLoading : isSessionLoading;
  const sessionEmptyState = isExternalDnpSource
    ? overdueOnly
      ? 'Belum ada open CAP External DNP yang overdue.'
      : 'Belum ada open CAP External DNP.'
    : 'Belum ada CAP terbuka.';
  const detailEmptyState = isExternalDnpSource
    ? 'Belum ada detail CAP External DNP yang cocok dengan filter ini.'
    : 'Belum ada temuan CAP.';

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
            {isExternalDnpSource
              ? 'Detail tindak lanjut CAP External DNP untuk Audit, Inspeksi, dan Surveillance.'
              : 'Daftar tindak lanjut dari seluruh temuan.'}
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
          data={displaySessionRows}
          isLoading={sessionTableLoading}
          emptyState={sessionEmptyState}
          columns={
            isExternalDnpSource
              ? [
                  {
                    header: 'No',
                    render: (row: CapSessionRow) => row.rowNumber,
                  },
                  {
                    header: 'Scope',
                    render: (row: CapSessionRow) => formatScope(row.scope),
                  },
                  {
                    header: 'Instansi',
                    render: (row: CapSessionRow) => row.instansiName || '-',
                  },
                  {
                    header: 'Area',
                    render: (row: CapSessionRow) => row.area || '-',
                  },
                  {
                    header: 'Ringkasan CAP',
                    render: (row: CapSessionRow) => (
                      <div className="space-y-1">
                        <div className="font-medium text-slate-700">
                          {row.openCapCount} open CAP
                        </div>
                        <div className="text-xs text-slate-500">
                          Total temuan {row.totalFindings}
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: 'PIC',
                    render: (row: CapSessionRow) => row.leader ?? '-',
                  },
                  {
                    header: 'Aksi',
                    render: (row: CapSessionRow) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCapSource(row)}
                      >
                        Buka Sumber
                      </Button>
                    ),
                  },
                ]
              : [
                  {
                    header: 'No',
                    render: (row: CapSessionRow) => row.rowNumber,
                  },
                  {
                    header: 'Scope',
                    render: (row: CapSessionRow) => formatScope(row.scope),
                  },
                  {
                    header: 'Area',
                    render: (row: CapSessionRow) => row.area || '-',
                  },
                  {
                    header: 'Total Temuan',
                    render: (row: CapSessionRow) => row.totalFindings,
                  },
                  { header: 'PIC', render: (row: CapSessionRow) => row.leader ?? '-' },
                  {
                    header: 'Aksi',
                    render: (row: CapSessionRow) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCapSource(row)}
                      >
                        Buka Sumber
                      </Button>
                    ),
                  },
                ]
          }
        />
      ) : (
        <DataTable
          data={filteredCaps}
          isLoading={isLoading}
          emptyState={detailEmptyState}
          columns={
            isExternalDnpSource
              ? [
                  {
                    header: 'Scope',
                    render: (row: CapRow) => formatScope(row.scope),
                  },
                  {
                    header: 'Instansi',
                    render: (row: CapRow) => row.instansiName || '-',
                  },
                  {
                    header: 'Area',
                    render: (row: CapRow) => row.area || '-',
                  },
                  {
                    header: 'Kategori',
                    render: (row: CapRow) => formatCategory(row),
                  },
                  {
                    header: 'Deadline',
                    render: (row: CapRow) => formatDeadline(row),
                  },
                  {
                    header: 'Status CAP',
                    render: (row: CapRow) => renderStatusBadge(row),
                  },
                  {
                    header: 'PIC',
                    render: (row: CapRow) => row.leader ?? '-',
                  },
                  {
                    header: 'Aksi',
                    render: (row: CapRow) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSource(row)}
                      >
                        Buka Sumber
                      </Button>
                    ),
                  },
                ]
              : [
                  {
                    header: 'Scope',
                    render: (row: CapRow) => formatScope(row.scope),
                  },
                  {
                    header: 'Area',
                    render: (row: CapRow) => row.area || '-',
                  },
                  {
                    header: 'Kategori',
                    render: (row: CapRow) => formatCategory(row),
                  },
                  { header: 'PIC', render: (row: CapRow) => row.leader ?? '-' },
                  {
                    header: 'Aksi',
                    render: (row: CapRow) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSource(row)}
                      >
                        Buka Sumber
                      </Button>
                    ),
                  },
                ]
          }
        />
      )}
    </div>
  );
}
