import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, FolderOpen, RefreshCw, Search } from 'lucide-react';
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
import {
  fetchSelfAssessmentCapFulfillmentSessions,
  fetchSelfAssessmentSessions,
  type SelfAssessmentSession,
} from '@/lib/selfAssessment';

const MONTH_OPTIONS = [
  { value: 'ALL', label: 'Semua', shortLabel: 'All' },
  { value: 'JANUARI', label: 'JANUARI', shortLabel: 'Jan' },
  { value: 'FEBRUARI', label: 'FEBRUARI', shortLabel: 'Feb' },
  { value: 'MARET', label: 'MARET', shortLabel: 'Mar' },
  { value: 'APRIL', label: 'APRIL', shortLabel: 'Apr' },
  { value: 'MEI', label: 'MEI', shortLabel: 'Mei' },
  { value: 'JUNI', label: 'JUNI', shortLabel: 'Jun' },
  { value: 'JULI', label: 'JULI', shortLabel: 'Jul' },
  { value: 'AGUSTUS', label: 'AGUSTUS', shortLabel: 'Agu' },
  { value: 'SEPTEMBER', label: 'SEPTEMBER', shortLabel: 'Sep' },
  { value: 'OKTOBER', label: 'OKTOBER', shortLabel: 'Okt' },
  { value: 'NOVEMBER', label: 'NOVEMBER', shortLabel: 'Nov' },
  { value: 'DESEMBER', label: 'DESEMBER', shortLabel: 'Des' },
];
const YEAR_OPTIONS = ['2026', '2025', '2024', '2023', '2022'];

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-44';

type MonitoringSessionItem = {
  sessionAreaId: string;
  title: string | null;
  area: string;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  fulfillmentCount: number;
  sentAt: string | null;
};

export function MonitoringSelfAssessment() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MonitoringSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [monitoringSessions, setMonitoringSessions] = useState<SelfAssessmentSession[]>([]);
  const [isMonitoringOpen, setIsMonitoringOpen] = useState<boolean | null>(null);
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;

  const loadMonitoringSessions = useCallback(() => {
    setIsMonitoringOpen(null);
    fetchSelfAssessmentSessions('monitoring')
      .then((data) => {
        setMonitoringSessions(data ?? []);
        setIsMonitoringOpen((data ?? []).length > 0);
      })
      .catch(() => {
        setMonitoringSessions([]);
        setIsMonitoringOpen(false);
      });
  }, []);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    if (isMonitoringOpen !== true) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchSelfAssessmentCapFulfillmentSessions({
        scope: 'monitoring',
        month: month === 'ALL' ? undefined : month,
        year: year || undefined,
      });
      setItems(data ?? []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [isMonitoringOpen, month, year]);

  useEffect(() => {
    loadMonitoringSessions();
  }, [loadMonitoringSessions]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const resolveMonitoringSession = useCallback((item: MonitoringSessionItem) => {
    if (monitoringSessions.length === 0) return null;
    const targetMatch = monitoringSessions.find((session) =>
      (session.targetSessionAreaIds ?? []).includes(item.sessionAreaId)
    );
    if (targetMatch) return targetMatch;
    if (item.sentAt) {
      const sentDate = new Date(item.sentAt);
      const matched = monitoringSessions.find((session) => {
        const start = session.startDate
          ? new Date(`${session.startDate}T00:00:00`)
          : null;
        const end = session.endDate
          ? new Date(`${session.endDate}T23:59:59`)
          : null;
        if (!start || !end) return false;
        return sentDate >= start && sentDate <= end;
      });
      if (matched) return matched;
    }
    return monitoringSessions.length === 1 ? monitoringSessions[0] : null;
  }, [monitoringSessions]);

  const resolveActivityLabel = useCallback((item: MonitoringSessionItem) => {
    const monitoringSession = resolveMonitoringSession(item);
    if (monitoringSession?.title?.trim()) return monitoringSession.title;
    if (item.title?.trim()) return item.title;
    return '-';
  }, [resolveMonitoringSession]);

  const isWithinMonitoringWindow = useCallback((sentAt: string | null) => {
    if (!sentAt || monitoringSessions.length === 0) {
      return true;
    }
    const sentDate = new Date(sentAt);
    return monitoringSessions.some((session) => {
      const start = session.startDate
        ? new Date(`${session.startDate}T00:00:00`)
        : null;
      const end = session.endDate
        ? new Date(`${session.endDate}T23:59:59`)
        : null;
      if (!start || !end) return true;
      return sentDate >= start && sentDate <= end;
    });
  }, [monitoringSessions]);

  const isWithinSessionWindows = (
    sentAt: string | null,
    sessions: Array<{ startDate: string; endDate: string }>
  ) => {
    if (!sentAt || sessions.length === 0) {
      return true;
    }
    const sentDate = new Date(sentAt);
    return sessions.some((session) => {
      const start = session.startDate
        ? new Date(`${session.startDate}T00:00:00`)
        : null;
      const end = session.endDate
        ? new Date(`${session.endDate}T23:59:59`)
        : null;
      if (!start || !end) return true;
      return sentDate >= start && sentDate <= end;
    });
  };

  const filteredItems = useMemo(() => {
    const term = activeSearch.trim().toLowerCase();
    const selectedTargetIds = monitoringSessions.flatMap(
      (session) => session.targetSessionAreaIds ?? []
    );
    const hasOpenAllAreaSession = monitoringSessions.some(
      (session) => !(session.targetSessionAreaIds?.length)
    );
    const sourceItemsByArea = hasOpenAllAreaSession
      ? monitoringSessions.length > 0
        ? items.filter((item) => isWithinMonitoringWindow(item.sentAt))
        : items
      : selectedTargetIds.length > 0
      ? items.filter((item) => selectedTargetIds.includes(item.sessionAreaId))
      : items;

    const selectedAgendaIds = Array.from(
      new Set(monitoringSessions.flatMap((session) => session.targetAgendaIds ?? []))
    );
    const hasOpenAllAgendaSession = monitoringSessions.some(
      (session) => !(session.targetAgendaIds?.length)
    );
    const monitoringById = new Map(monitoringSessions.map((session) => [session.id, session]));
    const selectedAgendaSessions = selectedAgendaIds
      .map((id) => monitoringById.get(id))
      .filter((session): session is SelfAssessmentSession => Boolean(session));

    const sourceItems = hasOpenAllAgendaSession
      ? sourceItemsByArea.filter((item) => isWithinMonitoringWindow(item.sentAt))
      : selectedAgendaSessions.length > 0
      ? sourceItemsByArea.filter((item) =>
          isWithinSessionWindows(item.sentAt, selectedAgendaSessions)
        )
      : sourceItemsByArea.filter((item) => isWithinMonitoringWindow(item.sentAt));

    if (!term) return sourceItems;
    return sourceItems.filter((item) => {
      const haystack = [
        item.area,
        item.leader,
        item.scope,
        resolveActivityLabel(item),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [activeSearch, isWithinMonitoringWindow, items, monitoringSessions, resolveActivityLabel]);

  const resetFilters = () => {
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setSearchText('');
    setActiveSearch('');
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <FileText className="h-5 w-5" />
              </span>
              <h1 className="text-lg font-semibold text-slate-800">
                Protocol Question (PQ)
              </h1>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Monitoring</span>
              <span>/</span>
              <span className="font-semibold text-blue-600">
                Protocol Question (PQ)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {badgeLabel}
            </span>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <FileText className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-800">
                  Data Self Assessment
                </h2>
                <p className="text-sm text-slate-500">
                  Lihat dan kelola data hasil pemenuhan CAP.
                </p>
              </div>
            </div>
          </div>
          {isMonitoringOpen === null && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Memeriksa status monitoring...
            </div>
          )}
          {isMonitoringOpen === false && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Monitoring belum dibuka oleh admin.
            </div>
          )}
          {isMonitoringOpen === true && (
          <>
          <div className="flex flex-wrap items-center gap-4">
            <select
              className={selectClassName}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className={selectClassName}
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {YEAR_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
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
                    Kegiatan
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
                    className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Tanggal Pelaksanaan
                  </TableHead>
                </TableRow>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    DNP
                  </TableHead>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    KOBU/Observer
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16">
                      <div className="flex flex-col items-center gap-3 text-center text-slate-500">
                        <div className="relative">
                          <FolderOpen className="h-16 w-16 text-blue-200" />
                          <Search className="absolute bottom-1 right-0 h-6 w-6 rounded-full bg-blue-100 p-1 text-blue-400" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-base font-semibold text-slate-700">
                            Belum ada data
                          </div>
                          <div className="text-sm text-slate-500">
                            Coba ubah filter bulan/tahun atau reset filter
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
                    <TableRow key={`${item.scope}-${item.sessionAreaId || index}`}>
                      <TableCell className="text-center text-sm">{index + 1}</TableCell>
                      <TableCell className="text-center text-sm">
                        {resolveActivityLabel(item)}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const areaLabel = item.area?.trim() ? item.area : '-';
                          const canOpenDetail = Boolean(item.sessionAreaId);
                          return (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                          onClick={() => {
                            if (!canOpenDetail) return;
                            navigate(
                              `/monitoring/protocol-question/self-assessment/${item.scope}/${item.sessionAreaId}`
                            );
                          }}
                          disabled={!canOpenDetail}
                        >
                          {areaLabel}
                        </Button>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.leader || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <ol className="list-decimal space-y-1 pl-4">
                          {(item.dnp ?? []).map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ol>
                      </TableCell>
                      <TableCell className="text-sm">
                        <ol className="list-decimal space-y-1 pl-4">
                          {(item.kobo ?? []).map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ol>
                      </TableCell>
                      <TableCell className="text-center text-sm text-slate-500">
                        {item.schedule ?? 'Menunggu admin'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
              Menampilkan {filteredItems.length || 0} dari total {items.length || 0}{' '}
              data
            </div>
          </div>
          </>
          )}
        </div>
      </section>
    </div>
  );
}
