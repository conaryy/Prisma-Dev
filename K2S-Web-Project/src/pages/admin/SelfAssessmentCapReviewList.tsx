import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
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
import { fetchAdminSelfAssessmentCapSessions } from '@/lib/selfAssessment';
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

type CapSummary = {
  sessionAreaId: string;
  user: { id: string; name: string; email?: string } | null;
  area: string;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  capCount: number;
  sentAt: string | null;
};

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-44';

const formatScopeLabel = (scopeValue: string) => {
  if (!scopeValue) return '-';
  return scopeValue.charAt(0).toUpperCase() + scopeValue.slice(1);
};

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

export function SelfAssessmentCapReviewList() {
  const navigate = useNavigate();
  const [scope, setScope] = useState('all');
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [items, setItems] = useState<CapSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadItems = useCallback(() => {
    setIsLoading(true);
    fetchAdminSelfAssessmentCapSessions({
      scope: scope === 'all' ? undefined : (scope as SelfAssessmentScope),
      month: month === 'ALL' ? undefined : month,
      year,
    })
      .then((data) => {
        setItems(data);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  }, [scope, month, year]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const search = activeSearch.trim().toLowerCase();
    const source = search
      ? items.filter((item) => {
          const haystack = [
            item.area,
            item.user?.name ?? '',
            item.scope,
            item.leader ?? '',
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(search);
        })
      : items;

    return [...source].sort((a, b) => {
      const scheduleDiff =
        parseScheduleReleaseTime(b.schedule) - parseScheduleReleaseTime(a.schedule);
      if (scheduleDiff !== 0) return scheduleDiff;
      const sentA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const sentB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return sentB - sentA;
    });
  }, [activeSearch, items]);

  const resetFilters = () => {
    setScope('all');
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
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
                Admin / CAP
              </p>
              <h1 className="text-lg font-semibold text-slate-800">Review CAP</h1>
            </div>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-center gap-4">
            <select
              className={selectClassName}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    No
                  </TableHead>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Scope
                  </TableHead>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Area
                  </TableHead>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Ketua Tim
                  </TableHead>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Anggota
                  </TableHead>
                  <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Auditee
                  </TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Tanggal Pelaksanaan
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
                    <TableRow
                      key={`${item.sessionAreaId}-${item.user?.id ?? 'user'}`}
                      className="cursor-pointer hover:bg-blue-50/60"
                      onClick={() =>
                        navigate(
                          `/admin/self-assessment-cap-reviews/${item.sessionAreaId}?userId=${item.user?.id ?? ''}`
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
                      <TableCell className="text-center text-sm">
                        {item.leader ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.dnp.length
                          ? item.dnp.map((name, idx) => (
                              <div key={`${item.sessionAreaId}-dnp-${idx}`}>
                                {idx + 1}. {name}
                              </div>
                            ))
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.kobo.length
                          ? item.kobo.map((name, idx) => (
                              <div key={`${item.sessionAreaId}-kobo-${idx}`}>
                                {idx + 1}. {name}
                              </div>
                            ))
                          : '-'}
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
