import { useEffect, useMemo, useState } from 'react';
import { Download, FolderOpen, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  fetchMonitoringResults,
  fetchSelfAssessmentResults,
  fetchSelfAssessmentSessions,
  type SelfAssessmentSession,
} from '@/lib/selfAssessment';
import { resolveApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'SEMUA' },
  { value: 'interim', label: 'INTERIM' },
  { value: 'final', label: 'FINAL' },
];

const YEAR_OPTIONS = ['', '2026', '2025', '2024', '2023', '2022'];

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-44';

type ResultItem = {
  id: string;
  sessionAreaId: string;
  area: string;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  status: string;
  finalizedAt: string | null;
  files: Array<{ id: string; name: string; url: string }>;
};

function ResultList({
  scope,
  title,
  monitoringMode = false,
}: {
  scope: 'audit' | 'monitoring' | 'inspeksi' | 'surveillance';
  title: string;
  monitoringMode?: boolean;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const isWithinMonitoringWindow = (
    timestamp: string | null,
    sessions: Array<{ startDate: string; endDate: string }>
  ) => {
    if (!timestamp || sessions.length === 0) {
      return true;
    }
    const value = new Date(timestamp);
    return sessions.some((session) => {
      const start = session.startDate
        ? new Date(`${session.startDate}T00:00:00`)
        : null;
      const end = session.endDate ? new Date(`${session.endDate}T23:59:59`) : null;
      if (!start || !end) return true;
      return value >= start && value <= end;
    });
  };

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const resultPromise = monitoringMode
        ? fetchMonitoringResults({
            status: status ? (status as 'interim' | 'final') : undefined,
            year: year || undefined,
          })
        : fetchSelfAssessmentResults({
            scope,
            status: status ? (status as 'interim' | 'final') : undefined,
            year: year || undefined,
          });
      const monitoringSessionPromise = monitoringMode
        ? fetchSelfAssessmentSessions('monitoring')
        : Promise.resolve([]);
      const [response, sessions] = await Promise.all([
        resultPromise,
        monitoringSessionPromise,
      ]);

      if (!monitoringMode) {
        setItems(response ?? []);
        return;
      }

      const monitoringSessionsData = (sessions as SelfAssessmentSession[]) ?? [];

      if (monitoringSessionsData.length === 0) {
        setItems([]);
        return;
      }

      const selectedTargetIds = monitoringSessionsData.flatMap(
        (session) => session.targetSessionAreaIds ?? []
      );
      const hasOpenAllAreaSession = monitoringSessionsData.some(
        (session) => !(session.targetSessionAreaIds?.length)
      );
      const sourceItemsByArea = hasOpenAllAreaSession
        ? (response ?? []).filter((item) =>
            isWithinMonitoringWindow(item.finalizedAt, monitoringSessionsData)
          )
        : selectedTargetIds.length > 0
        ? (response ?? []).filter((item) => selectedTargetIds.includes(item.sessionAreaId))
        : [];

      const selectedAgendaIds = Array.from(
        new Set(monitoringSessionsData.flatMap((session) => session.targetAgendaIds ?? []))
      );
      const hasOpenAllAgendaSession = monitoringSessionsData.some(
        (session) => !(session.targetAgendaIds?.length)
      );
      const monitoringById = new Map(
        monitoringSessionsData.map((session) => [session.id, session])
      );
      const selectedAgendaSessions = selectedAgendaIds
        .map((id) => monitoringById.get(id))
        .filter((session): session is SelfAssessmentSession => Boolean(session));

      const sourceItems = hasOpenAllAgendaSession
        ? sourceItemsByArea.filter((item) =>
            isWithinMonitoringWindow(item.finalizedAt, monitoringSessionsData)
          )
        : selectedAgendaSessions.length > 0
        ? sourceItemsByArea.filter((item) =>
            isWithinMonitoringWindow(item.finalizedAt, selectedAgendaSessions)
          )
        : sourceItemsByArea.filter((item) =>
            isWithinMonitoringWindow(item.finalizedAt, monitoringSessionsData)
          );

      setItems(sourceItems);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, status, year, monitoringMode]);

  const filteredItems = useMemo(() => {
    const search = activeSearch.trim().toLowerCase();
    if (!search) return items;
    return items.filter((item) => {
      const haystack = [item.area, item.leader, item.scope].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [activeSearch, items]);

  const resetFilters = () => {
    setStatus('');
    setYear(YEAR_OPTIONS[0]);
    setSearchText('');
    setActiveSearch('');
  };

  const badgeLabel = status || year
    ? `${status ? status.toUpperCase() : 'SEMUA'}${year ? ` ${year}` : ''}`
    : 'Semua Periode';

  const openMonitoringDetail = (item: ResultItem) => {
    navigate(
      `/monitoring/hasil/${item.sessionAreaId}?area=${encodeURIComponent(item.area)}&scope=${encodeURIComponent(item.scope)}&schedule=${encodeURIComponent(item.schedule ?? '')}`
    );
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <Download className="h-5 w-5" />
              </span>
              <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Hasil</span>
              <span>/</span>
              <span className="font-semibold text-blue-600">{title}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {badgeLabel}
            </span>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-center gap-4">
            <select
              className={selectClassName}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-32"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {YEAR_OPTIONS.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option || 'SEMUA'}
                </option>
              ))}
            </select>
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-blue-200/70" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="h-11 rounded-xl border border-input bg-white/80 pl-9 text-slate-700 placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-100"
                placeholder="Cari area atau ketua tim..."
              />
            </div>
            <Button
              type="button"
              className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
              onClick={() => {
                setActiveSearch(searchText);
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
              onClick={resetFilters}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Table className="w-full">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead
                    rowSpan={2}
                    className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    No
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Area
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Ketua Tim
                  </TableHead>
                  <TableHead
                    colSpan={2}
                    className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Anggota
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Tanggal Pelaksanaan
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Status
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    File
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Anggota
                  </TableHead>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Audity
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-center text-slate-500">
                        <div className="relative">
                          <FolderOpen className="h-16 w-16 text-blue-200" />
                          <Search className="absolute bottom-1 right-0 h-6 w-6 rounded-full bg-blue-100 p-1 text-blue-400" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-base font-semibold text-slate-700">
                            Belum ada hasil
                          </div>
                          <div className="text-sm text-slate-500">
                            Coba ubah filter atau reset filter
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                            onClick={resetFilters}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reset Filter
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className={monitoringMode ? 'cursor-pointer' : undefined}
                      onClick={
                        monitoringMode
                          ? () => openMonitoringDetail(item)
                          : undefined
                      }
                    >
                      <TableCell className="text-center text-sm">{index + 1}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (monitoringMode) {
                              openMonitoringDetail(item);
                            }
                          }}
                        >
                          {item.area}
                        </Button>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.leader || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <ol className="list-decimal space-y-1 pl-4">
                          {(item.dnp ?? []).length ? (
                            item.dnp.map((name) => <li key={name}>{name}</li>)
                          ) : (
                            <li className="text-slate-400">-</li>
                          )}
                        </ol>
                      </TableCell>
                      <TableCell className="text-sm">
                        <ol className="list-decimal space-y-1 pl-4">
                          {(item.kobo ?? []).length ? (
                            item.kobo.map((name) => <li key={name}>{name}</li>)
                          ) : (
                            <li className="text-slate-400">-</li>
                          )}
                        </ol>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.schedule ?? '-'}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <StatusBadge status={item.status === 'final' ? 'Final' : 'Interim'} />
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.files?.length ? (
                          <div className="flex flex-col items-center gap-1">
                            {item.files.map((file) => (
                              <a
                                key={file.id}
                                href={resolveApiUrl(file.url)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100'
                                )}
                              >
                                <Download className="h-3 w-3" />
                                <span className="max-w-[140px] truncate">{file.name}</span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AuditResults() {
  return <ResultList scope="audit" title="Hasil Audit" />;
}

export function MonitoringResults() {
  return <ResultList scope="monitoring" title="Hasil Monitoring" monitoringMode />;
}

export function InspeksiResults() {
  return <ResultList scope="inspeksi" title="Hasil Inspeksi" />;
}

export function SurveillanceResults() {
  return <ResultList scope="surveillance" title="Hasil Surveillance" />;
}
