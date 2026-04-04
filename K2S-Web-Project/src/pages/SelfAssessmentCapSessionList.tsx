import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, FolderOpen, Loader2, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from '@/hooks/use-toast';
import { formatDateRangeIndonesian } from '@/lib/date';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchSelfAssessmentCapSessions } from '@/lib/selfAssessment';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

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
const YEAR_OPTIONS = ['ALL', '2026', '2025', '2024', '2023', '2022'];
const ALL_INSTANSI_OPTION = 'ALL';

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-44';
const EXTERNAL_DNP_ACTIVE_SESSION_KEY = 'k2s.externalDnp.activeSessionInstansi';
const EXTERNAL_DNP_ACTIVE_SESSION_OLD_KEY = 'k2s.externalDnp.activeSessionCreatedBy';

type SessionItem = {
  sessionAreaId: string;
  area: string;
  instansiName?: string | null;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  notSatisfactoryCount: number;
  finalizedAt: string | null;
};

type GroupedSessionItem = {
  key: string;
  instansiName: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  schedule: string | null;
  scope: string;
  areas: Array<{
    label: string;
    sessionAreaId: string;
  }>;
};

interface SelfAssessmentCapSessionListProps {
  scope: SelfAssessmentScope;
  title: string;
  mode: 'penyusunan' | 'pemenuhan';
  basePath?: string;
  fetchSessions?: (params: {
    scope: SelfAssessmentScope;
    month?: string;
    year?: string;
  }) => Promise<SessionItem[]>;
  onSync?: () => Promise<unknown>;
  syncLabel?: string;
  syncInit?: () => Promise<{ sessionId: string; captchaUrl: string }>;
  syncRun?: (payload: {
    sessionId: string;
    captcha: string;
    username: string;
    password: string;
  }) => Promise<unknown>;
  syncStart?: (payload: {
    sessionId: string;
    captcha: string;
    username: string;
    password: string;
    scope?: SelfAssessmentScope;
  }) => Promise<{
    jobId: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    message?: string | null;
  }>;
  syncJobStatus?: (jobId: string) => Promise<{
    jobId: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    message?: string | null;
    error?: string | null;
    summary?: Record<string, unknown> | null;
  }>;
  pageSize?: number;
}

export function SelfAssessmentCapSessionList({
  scope,
  title,
  mode,
  basePath = '',
  fetchSessions,
  onSync,
  syncLabel = 'Update Data',
  syncInit,
  syncRun,
  syncStart,
  syncJobStatus,
  pageSize,
}: SelfAssessmentCapSessionListProps) {
  const navigate = useNavigate();
  const showInstansi = basePath === 'external-dnp';
  const effectivePageSize = pageSize ?? (showInstansi ? 5 : 0);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [syncUsername, setSyncUsername] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncJobId, setSyncJobId] = useState('');
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [instansiFilter, setInstansiFilter] = useState(ALL_INSTANSI_OPTION);
  const [activeSessionInstansi, setActiveSessionInstansi] = useState<string>('');
  const [page, setPage] = useState(1);
  const syncJobStorageKey = `k2s.externalDnp.syncJob.${scope}`;

  const extractInstansiName = (value: unknown): string => {
    if (!value || typeof value !== 'object') return '';
    const map = value as Record<string, unknown>;
    const direct =
      (typeof map.instansiName === 'string' && map.instansiName.trim()) ||
      (typeof map.instansi_name === 'string' && map.instansi_name.trim()) ||
      '';
    if (direct) return direct;
    for (const nested of Object.values(map)) {
      const found = extractInstansiName(nested);
      if (found) return found;
    }
    return '';
  };

  const persistActiveSessionInstansi = (value: string) => {
    if (!value) return;
    setActiveSessionInstansi(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EXTERNAL_DNP_ACTIVE_SESSION_KEY, value);
    }
  };

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const load = fetchSessions ?? fetchSelfAssessmentCapSessions;
      const response = await load({
        scope,
        month: month === 'ALL' ? undefined : month,
        year: year === 'ALL' ? undefined : year || undefined,
      });
      setItems(response ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, month, year]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved =
      window.localStorage.getItem(EXTERNAL_DNP_ACTIVE_SESSION_KEY) ??
      window.localStorage.getItem(EXTERNAL_DNP_ACTIVE_SESSION_OLD_KEY) ??
      '';
    setActiveSessionInstansi(saved);
  }, []);

  useEffect(() => {
    if (!syncJobStatus) return;
    if (typeof window === 'undefined') return;
    const savedJobId = window.localStorage.getItem(syncJobStorageKey) ?? '';
    if (savedJobId) {
      setSyncJobId(savedJobId);
    }
  }, [syncJobStatus, syncJobStorageKey]);

  useEffect(() => {
    if (!syncJobStatus || !syncJobId) return;

    let stopped = false;
    setIsSyncing(true);

    const poll = async () => {
      try {
        const status = await syncJobStatus(syncJobId);
        if (stopped) return;

        if (status.status === 'succeeded') {
          const instansiName = extractInstansiName(status.summary ?? {});
          persistActiveSessionInstansi(instansiName);
          toast({
            title: 'Update selesai',
            description: status.message ?? 'Sinkronisasi data selesai.',
          });
          setSyncJobId('');
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(syncJobStorageKey);
          }
          setIsSyncing(false);
          await loadItems();
          return;
        }

        if (status.status === 'failed') {
          toast({
            title: 'Gagal memperbarui data',
            description: status.error ?? status.message ?? 'Terjadi kesalahan.',
          });
          setSyncJobId('');
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(syncJobStorageKey);
          }
          setIsSyncing(false);
          return;
        }

        setTimeout(() => {
          if (!stopped) {
            void poll();
          }
        }, 2500);
      } catch {
        if (stopped) return;
        setTimeout(() => {
          if (!stopped) {
            void poll();
          }
        }, 3000);
      }
    };

    void poll();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncJobId, syncJobStatus, syncJobStorageKey]);

  const instansiOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        items
          .map((item) => (item.instansiName ?? '').trim())
          .filter((name) => name !== '')
      )
    ).sort((a, b) => a.localeCompare(b, 'id'));

    return [{ value: ALL_INSTANSI_OPTION, label: 'Semua Instansi' }, ...names.map((name) => ({
      value: name,
      label: name,
    }))];
  }, [items]);

  const filteredItems = useMemo(() => {
    const search = activeSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (showInstansi) {
        const itemInstansi = (item.instansiName ?? '').trim();
        const matchInstansi =
          instansiFilter === ALL_INSTANSI_OPTION || itemInstansi === instansiFilter;
        if (!matchInstansi) return false;
      }
      if (!search) return true;
      const haystack = [item.area, item.instansiName ?? '', item.leader, item.scope]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [activeSearch, instansiFilter, items, showInstansi]);

  const groupedItems = useMemo<GroupedSessionItem[]>(() => {
    const grouped = new Map<string, GroupedSessionItem>();
    filteredItems.forEach((item) => {
      const schedule = item.schedule ?? '-';
      const key = [
        item.instansiName ?? '',
        item.scope,
        schedule,
        item.leader,
        item.dnp.join('|'),
        item.kobo.join('|'),
      ].join('::');

      const existing = grouped.get(key);
      const areaLabel = item.area || '-';
      const areaEntry = { label: areaLabel, sessionAreaId: item.sessionAreaId };
      if (!existing) {
        grouped.set(key, {
          key,
          instansiName: item.instansiName ?? null,
          leader: item.leader,
          dnp: item.dnp,
          kobo: item.kobo,
          schedule: item.schedule,
          scope: item.scope,
          areas: [areaEntry],
        });
      } else if (!existing.areas.find((area) => area.sessionAreaId === item.sessionAreaId)) {
        existing.areas.push(areaEntry);
      }
    });
    return Array.from(grouped.values());
  }, [filteredItems]);

  const totalPages =
    effectivePageSize > 0
      ? Math.max(1, Math.ceil(groupedItems.length / effectivePageSize))
      : 1;

  useEffect(() => {
    setPage(1);
  }, [month, year, instansiFilter, activeSearch, effectivePageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    if (effectivePageSize <= 0) {
      return groupedItems;
    }

    const start = (page - 1) * effectivePageSize;
    return groupedItems.slice(start, start + effectivePageSize);
  }, [effectivePageSize, groupedItems, page]);

  const resetFilters = () => {
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setInstansiFilter(ALL_INSTANSI_OPTION);
    setSearchText('');
    setActiveSearch('');
    setPage(1);
  };

  const handleSync = async () => {
    if (syncInit && (syncStart || syncRun)) {
      setIsSyncing(true);
      try {
        const init = await syncInit();
        setCaptchaSessionId(init.sessionId);
        setCaptchaUrl(init.captchaUrl);
        setCaptchaValue('');
        setSyncUsername('');
        setSyncPassword('');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
        toast({
          title: 'Gagal memulai update',
          description: message,
        });
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    if (!onSync) return;
    setIsSyncing(true);
    try {
      const result = await onSync();
      const instansiName = extractInstansiName(result);
      persistActiveSessionInstansi(instansiName);
      toast({
        title: 'Update selesai',
        description: instansiName
          ? `Data terbaru berhasil diperbarui. Sesi aktif: ${instansiName}.`
          : 'Data terbaru berhasil diperbarui.',
      });
      await loadItems();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
      toast({
        title: 'Gagal memperbarui data',
        description: message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncRun = async () => {
    if ((!syncRun && !syncStart) || !captchaSessionId || !captchaValue || !syncUsername || !syncPassword) {
      return;
    }

    if (syncStart && syncJobStatus) {
      setIsSyncing(true);
      try {
        const started = await syncStart({
          sessionId: captchaSessionId,
          captcha: captchaValue,
          username: syncUsername,
          password: syncPassword,
          scope,
        });
        setSyncJobId(started.jobId);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(syncJobStorageKey, started.jobId);
        }
        toast({
          title: 'Update dimulai',
          description: started.message ?? 'Sinkronisasi berjalan di background.',
        });
        setCaptchaSessionId('');
        setCaptchaUrl('');
        setCaptchaValue('');
        setSyncUsername('');
        setSyncPassword('');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
        toast({
          title: 'Gagal memulai update',
          description: message,
        });
        setIsSyncing(false);
      }
      return;
    }

    if (!syncRun) return;

    setIsSyncing(true);
    try {
      const result = await syncRun({
        sessionId: captchaSessionId,
        captcha: captchaValue,
        username: syncUsername,
        password: syncPassword,
      });
      const instansiName = extractInstansiName(result);
      persistActiveSessionInstansi(instansiName);
      toast({
        title: 'Update selesai',
        description: instansiName
          ? `Data terbaru berhasil diperbarui. Sesi aktif: ${instansiName}.`
          : 'Data terbaru berhasil diperbarui.',
      });
      setCaptchaSessionId('');
      setCaptchaUrl('');
      setCaptchaValue('');
      setSyncUsername('');
      setSyncPassword('');
      await loadItems();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
      toast({
        title: 'Gagal memperbarui data',
        description: message,
      });
      setCaptchaSessionId('');
      setCaptchaUrl('');
      setCaptchaValue('');
      setSyncUsername('');
      setSyncPassword('');
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
                <p className="text-sm text-slate-500">
                  Lihat dan kelola data CAP Protocol Question (PQ).
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {(onSync || (syncInit && (syncStart || syncRun))) && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                  onClick={handleSync}
                  disabled={isSyncing || Boolean(syncJobId)}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memuat
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {syncLabel}
                    </>
                  )}
                </Button>
              )}
              <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                {badgeLabel}
              </span>
            </div>
            {showInstansi && activeSessionInstansi && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Sesi aktif: {activeSessionInstansi}
              </div>
            )}
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          {captchaUrl && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm font-semibold text-slate-700">
                  Masukkan Akun DNP dan Captcha untuk Update Data
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-slate-200 px-3 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                  onClick={handleSync}
                  disabled={isSyncing || Boolean(syncJobId)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Ganti Captcha
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Input
                  value={syncUsername}
                  onChange={(event) => setSyncUsername(event.target.value)}
                  className="h-11 w-48 rounded-xl bg-white"
                  placeholder="Username DNP"
                  autoComplete="username"
                />
                <Input
                  type="password"
                  value={syncPassword}
                  onChange={(event) => setSyncPassword(event.target.value)}
                  className="h-11 w-48 rounded-xl bg-white"
                  placeholder="Password DNP"
                  autoComplete="current-password"
                />
                <img
                  src={captchaUrl}
                  alt="Captcha"
                  className="h-12 rounded-lg border border-slate-200"
                />
                <Input
                  value={captchaValue}
                  onChange={(event) => setCaptchaValue(event.target.value)}
                  className="h-11 w-48 rounded-xl bg-white"
                  placeholder="Isi captcha"
                />
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
                  onClick={handleSyncRun}
                  disabled={isSyncing || Boolean(syncJobId) || !syncUsername || !syncPassword || !captchaValue}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memproses
                    </>
                  ) : (
                    'Update Sekarang'
                  )}
                </Button>
              </div>
            </div>
          )}
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
                  {option === 'ALL' ? 'Semua Tahun' : option}
                </option>
              ))}
            </select>
            {showInstansi && (
              <select
                className={selectClassName}
                value={instansiFilter}
                onChange={(event) => setInstansiFilter(event.target.value)}
              >
                {instansiOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
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

          <div className="px-6 pb-6">
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
                    {showInstansi && (
                      <TableHead
                        rowSpan={2}
                        className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                      >
                        Instansi
                      </TableHead>
                    )}
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
                      Anggota
                    </TableHead>
                    <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Audity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={showInstansi ? 7 : 6}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : groupedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showInstansi ? 7 : 6} className="py-16">
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
                    paginatedItems.map((item, index) => (
                      <TableRow key={item.key}>
                        <TableCell className="text-center text-sm">
                          {effectivePageSize > 0
                            ? (page - 1) * effectivePageSize + index + 1
                            : index + 1}
                        </TableCell>
                        {showInstansi && (
                          <TableCell className="text-center text-sm text-slate-600">
                            {item.instansiName || '-'}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {item.areas.map((area) => (
                              <Button
                                key={area.sessionAreaId}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                                onClick={() => {
                                  const prefix = basePath ? `/${basePath}` : '';
                                  navigate(
                                    `${prefix}/${scope}/cap/${mode}/${area.sessionAreaId}`
                                  );
                                }}
                              >
                                {area.label}
                              </Button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {item.leader}
                        </TableCell>
                        <TableCell className="text-sm">
                          <ol className="list-decimal space-y-1 pl-4">
                            {item.dnp.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ol>
                        </TableCell>
                        <TableCell className="text-sm">
                          <ol className="list-decimal space-y-1 pl-4">
                            {item.kobo.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ol>
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-500">
                          {item.schedule
                            ? formatDateRangeIndonesian(item.schedule)
                            : 'Menunggu admin'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {effectivePageSize > 0 && groupedItems.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  Menampilkan {(page - 1) * effectivePageSize + 1}-
                  {Math.min(page * effectivePageSize, groupedItems.length)} dari {groupedItems.length} data
                </div>
                <Pagination className="justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (page > 1) {
                            setPage(page - 1);
                          }
                        }}
                        className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          href="#"
                          isActive={pageNumber === page}
                          onClick={(event) => {
                            event.preventDefault();
                            setPage(pageNumber);
                          }}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (page < totalPages) {
                            setPage(page + 1);
                          }
                        }}
                        className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
