import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
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
import { toast } from '@/hooks/use-toast';
import { fetchAdminSelfAssessmentCapFulfillmentSessions } from '@/lib/selfAssessment';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'audit', label: 'Audit' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'inspeksi', label: 'Inspeksi' },
  { value: 'surveillance', label: 'Surveillance' },
];
const MONTH_OPTIONS = [
  { value: 'ALL', label: 'Semua' },
  { value: 'JANUARI', label: 'JANUARI' },
  { value: 'FEBRUARI', label: 'FEBRUARI' },
  { value: 'MARET', label: 'MARET' },
  { value: 'APRIL', label: 'APRIL' },
  { value: 'MEI', label: 'MEI' },
  { value: 'JUNI', label: 'JUNI' },
  { value: 'JULI', label: 'JULI' },
  { value: 'AGUSTUS', label: 'AGUSTUS' },
  { value: 'SEPTEMBER', label: 'SEPTEMBER' },
  { value: 'OKTOBER', label: 'OKTOBER' },
  { value: 'NOVEMBER', label: 'NOVEMBER' },
  { value: 'DESEMBER', label: 'DESEMBER' },
];
const YEAR_OPTIONS = ['2026', '2025', '2024', '2023', '2022'];

type FulfillmentSession = {
  sessionAreaId: string;
  user: { id: string; name: string; email?: string } | null;
  area: string;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  fulfillmentCount: number;
  sentAt: string | null;
};

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-44';

const parseScheduleReleaseTime = (schedule: string | null) => {
  if (!schedule) return 0;
  const dateMatches = schedule.match(/\d{4}-\d{2}-\d{2}/g);
  const rawReleaseDate = dateMatches?.[0] ?? schedule.trim();
  if (!rawReleaseDate) return 0;
  const parsed = new Date(rawReleaseDate).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatScheduleDisplay = (schedule: string | null, fallback = 'Menunggu admin') => {
  if (!schedule) return fallback;
  const dateMatches = schedule.match(/\d{4}-\d{2}-\d{2}/g);
  if (!dateMatches || dateMatches.length === 0) return schedule;

  const formatOne = (dateText: string) => {
    const parsed = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateText;
    return parsed.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (dateMatches.length >= 2) {
    return `${formatOne(dateMatches[0])} - ${formatOne(dateMatches[1])}`;
  }

  return formatOne(dateMatches[0]);
};

const formatScopeLabel = (scopeValue: string) => {
  if (!scopeValue) return '-';
  return scopeValue.charAt(0).toUpperCase() + scopeValue.slice(1);
};

type SelfAssessmentCapFulfillmentListProps = {
  initialScope?: SelfAssessmentScope | 'all';
  lockScope?: boolean;
  hideScopeFilter?: boolean;
  groupLabel?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
  detailBasePath?: string;
  showUserColumn?: boolean;
  userColumnLabel?: string;
  searchPlaceholder?: string;
  openedOnly?: boolean;
};

export function SelfAssessmentCapFulfillmentList({
  initialScope = 'all',
  lockScope = false,
  hideScopeFilter = false,
  groupLabel = 'Admin / CAP',
  title = 'Hasil Pemenuhan CAP',
  description,
  emptyMessage = 'Belum ada data pemenuhan CAP.',
  detailBasePath = '/admin/self-assessment-cap-fulfillments',
  showUserColumn = false,
  userColumnLabel = 'User',
  searchPlaceholder = 'Cari area atau ketua tim...',
  openedOnly = false,
}: SelfAssessmentCapFulfillmentListProps = {}) {
  const navigate = useNavigate();
  const resolvedInitialScope = useMemo(() => {
    const initialValue = initialScope ?? 'all';
    return SCOPE_OPTIONS.some((option) => option.value === initialValue)
      ? initialValue
      : 'all';
  }, [initialScope]);
  const [scope, setScope] = useState<SelfAssessmentScope | 'all'>(
    resolvedInitialScope as SelfAssessmentScope | 'all'
  );
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [items, setItems] = useState<FulfillmentSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (item.user?.id) {
        map.set(item.user.id, item.user.name || item.user.email || 'User');
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const loadItems = useCallback(() => {
    setIsLoading(true);
    fetchAdminSelfAssessmentCapFulfillmentSessions({
      scope: scope === 'all' ? undefined : (scope as SelfAssessmentScope),
      month: month === 'ALL' ? undefined : month,
      year,
      openedOnly,
    })
      .then((data) => {
        setItems(data);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  }, [scope, month, year, openedOnly]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!lockScope) {
      return;
    }
    setScope(resolvedInitialScope as SelfAssessmentScope | 'all');
  }, [lockScope, resolvedInitialScope]);

  const filteredItems = useMemo(() => {
    const search = activeSearch.trim().toLowerCase();
    const source = items.filter((item) => {
      if (selectedUserId !== 'all' && item.user?.id !== selectedUserId) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = [
        item.area,
        item.leader,
        item.scope,
        item.user?.name ?? '',
        item.user?.email ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });

    return [...source].sort((a, b) => {
      const scheduleDiff =
        parseScheduleReleaseTime(b.schedule) - parseScheduleReleaseTime(a.schedule);
      if (scheduleDiff !== 0) return scheduleDiff;
      const sentA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const sentB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return sentB - sentA;
    });
  }, [activeSearch, items, selectedUserId]);

  const resetFilters = () => {
    setScope(
      (lockScope ? resolvedInitialScope : 'all') as SelfAssessmentScope | 'all'
    );
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setSelectedUserId('all');
    setSearchText('');
    setActiveSearch('');
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {groupLabel}
              </p>
              <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-center gap-4">
            {!hideScopeFilter ? (
              <select
                className={selectClassName}
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as SelfAssessmentScope | 'all')
                }
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
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
            {showUserColumn ? (
              <select
                className={selectClassName}
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                <option value="all">Semua User</option>
                {userOptions.map((userOption) => (
                  <option key={userOption.id} value={userOption.id}>
                    {userOption.name}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-blue-200/70" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="h-11 rounded-xl border border-input bg-white/80 pl-9 text-slate-700 placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-100"
                placeholder={searchPlaceholder}
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
                    Scope
                  </TableHead>
                  <TableHead
                    rowSpan={2}
                    className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                  >
                    Area
                  </TableHead>
                  {showUserColumn ? (
                    <TableHead
                      rowSpan={2}
                      className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                    >
                      {userColumnLabel}
                    </TableHead>
                  ) : null}
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
                    Auditee
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={showUserColumn ? 8 : 7}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showUserColumn ? 8 : 7}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item, index) => (
                    <TableRow
                      key={`${item.sessionAreaId}-${item.user?.id ?? 'user'}`}
                      className="cursor-pointer hover:bg-blue-50/60"
                      onClick={() =>
                        navigate(
                          `${detailBasePath}/${item.sessionAreaId}?userId=${item.user?.id ?? ''}`
                        )
                      }
                    >
                      <TableCell className="text-center text-sm">{index + 1}</TableCell>
                      <TableCell className="text-center text-sm">
                        {formatScopeLabel(item.scope)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                        >
                          {item.area}
                        </Button>
                      </TableCell>
                      {showUserColumn ? (
                        <TableCell className="text-center text-sm">
                          <div className="font-medium text-slate-700">
                            {item.user?.name ?? '-'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.user?.email ?? '-'}
                          </div>
                        </TableCell>
                      ) : null}
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
                        {formatScheduleDisplay(item.schedule, 'Menunggu admin')}
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
