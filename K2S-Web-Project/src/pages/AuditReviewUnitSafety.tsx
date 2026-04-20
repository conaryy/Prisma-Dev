import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ClipboardCheck,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { getAuthUser, resolveApiUrl } from '@/lib/api';
import { formatDateRangeIndonesian } from '@/lib/date';
import {
  fetchSelfAssessmentReviewDetail,
  fetchSelfAssessmentReviewList,
} from '@/lib/selfAssessment';
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
const YEAR_OPTIONS = ['2026', '2025', '2024', '2023', '2022'];

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-900/50 sm:w-60';

interface AuditReviewUnitSafetyProps {
  scopeLabel?: string;
}

export function AuditReviewUnitSafety({ scopeLabel = 'Audit' }: AuditReviewUnitSafetyProps) {
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<
    Array<{
      sessionAreaId: string;
      area: string;
      scope: string;
      schedule: string | null;
      leader: string;
      dnp: string[];
      kobo: string[];
      questionCount: number;
      submittedAt: string | null;
    }>
  >([]);
  const [selected, setSelected] = useState<{
    sessionAreaId: string;
    area: string;
    schedule: string | null;
  } | null>(null);
  const [detail, setDetail] = useState<{
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    answers: Array<{
      id: string;
      questionCode: string;
      questionText: string;
      reference: string | null;
      status: string;
      comment: string | null;
      evidenceNote?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
      createdBy?: { id: string; name: string; email?: string } | null;
      submittedAt: string | null;
      evidence: Array<{ id: string; name: string; url: string }>;
      review: {
        id: string;
        status: string;
        comment: string | null;
        severity?: string | null;
        probability?: string | null;
        resume?: string | null;
        description?: string | null;
        finding?: string | null;
        recommendations?: string | null;
        remark?: string | null;
        allowReply: boolean;
        isFinal: boolean;
        sentAt: string | null;
        reviewer?: { id: string; name: string; email?: string } | null;
      } | null;
    }>;
  } | null>(null);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const authUser = getAuthUser<{ name?: string }>();

  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;

  const resetFilters = () => {
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setSearchText('');
  };

  const scopeValue = scopeLabel.toLowerCase() as SelfAssessmentScope;

  const loadItems = useCallback(() => {
    fetchSelfAssessmentReviewList({
      scope: scopeValue,
      month: month === 'ALL' ? undefined : month,
      year,
    })
      .then((data) => setItems(data))
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data',
          description: error.message || 'Terjadi kesalahan.',
        });
      });
  }, [scopeValue, month, year]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) {
      return items;
    }
    const term = searchText.toLowerCase();
    return items.filter((item) =>
      `${item.area} ${item.leader}`.toLowerCase().includes(term)
    );
  }, [items, searchText]);

  const openDetail = (item: { sessionAreaId: string; area: string; schedule: string | null }) => {
    setSelected(item);
    fetchSelfAssessmentReviewDetail(item.sessionAreaId)
      .then((data) => {
        setDetail(data);
        setActiveAnswerId(data.answers[0]?.id ?? null);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat detail',
          description: error.message || 'Terjadi kesalahan.',
        });
      });
  };

  const activeAnswer = detail?.answers.find((answer) => answer.id === activeAnswerId);

  if (detail && selected) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Hasil Review Unit Safety
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                {selected.area} • {formatDateRangeIndonesian(selected.schedule)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setDetail(null);
              setSelected(null);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#0f1e45]">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Daftar Pertanyaan</h2>
            <div className="overflow-hidden divide-y rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {detail.answers.map((answer) => (
                <button
                  key={answer.id}
                  type="button"
                  className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition ${
                    activeAnswerId === answer.id
                      ? 'bg-blue-100 text-slate-900 dark:bg-blue-900/40 dark:text-slate-100'
                      : 'text-slate-700 hover:bg-amber-300 dark:text-slate-200 dark:hover:bg-amber-500/60'
                  }`}
                  onClick={() => setActiveAnswerId(answer.id)}
                >
                  <span className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                    {answer.questionCode}
                  </span>
                  <span className="flex-1">{answer.questionText}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#0f1e45]">
            {activeAnswer ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Protocol Question
                    </label>
                    <Textarea
                      rows={4}
                      value={`${activeAnswer.questionCode} - ${activeAnswer.questionText}`}
                      disabled
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Comment
                    </label>
                    <Textarea
                      rows={4}
                      value={activeAnswer.comment ?? ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-3 md:col-span-1">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Created By
                      </label>
                      <Input
                        value={activeAnswer.createdBy?.name ?? authUser?.name ?? '-'}
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Created At
                      </label>
                      <Input value={activeAnswer.createdAt ?? activeAnswer.submittedAt ?? '-'} disabled />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Referensi Regulasi
                    </label>
                    <Textarea
                      rows={4}
                      value={activeAnswer.reference ?? ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Evidence
                    </label>
                    <Textarea
                      rows={4}
                      value={activeAnswer.evidenceNote ?? ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-3 md:col-span-1">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Edited By
                      </label>
                      <Input
                        value={
                          activeAnswer.createdBy?.name ?? authUser?.name ?? '-'
                        }
                        disabled
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Last Modified
                      </label>
                      <Input
                        value={
                          activeAnswer.updatedAt ??
                          activeAnswer.submittedAt ??
                          '-'
                        }
                        disabled
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Status Of Implementation
                    </label>
                    <Input value={activeAnswer.status ?? '-'} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    File evidence
                  </div>
                  {activeAnswer.evidence.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-300">Belum ada evidence.</div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      <Table>
                        <TableHeader className="bg-slate-50/80 dark:bg-slate-800/70">
                          <TableRow>
                            <TableHead className="w-16 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                              No
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
                              Filename
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeAnswer.evidence.map((item, index) => (
                            <TableRow key={item.id}>
                              <TableCell className="text-center text-sm">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-sm text-blue-600">
                                <a
                                  href={resolveApiUrl(item.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:underline"
                                >
                                  {item.name}
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Review Unit Safety
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Status Of Implementation
                        </label>
                        <Input
                          value={activeAnswer.review?.status ?? '-'}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Severity
                        </label>
                        <Input
                          value={activeAnswer.review?.severity ?? '-'}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Probability
                        </label>
                        <Input
                          value={activeAnswer.review?.probability ?? '-'}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Resume
                        </label>
                        <Input
                          value={activeAnswer.review?.resume ?? '-'}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Review By
                        </label>
                        <Input
                          value={activeAnswer.review?.reviewer?.name ?? '-'}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Review At
                        </label>
                        <Input
                          value={activeAnswer.review?.sentAt ?? '-'}
                          disabled
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Description
                        </label>
                        <Textarea
                          rows={4}
                          value={
                            activeAnswer.review?.description ??
                            activeAnswer.review?.comment ??
                            ''
                          }
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Recommendations
                        </label>
                        <Textarea
                          rows={4}
                          value={activeAnswer.review?.recommendations ?? ''}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Finding
                        </label>
                        <Textarea
                          rows={4}
                          value={activeAnswer.review?.finding ?? ''}
                          disabled
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Remark
                        </label>
                        <Textarea
                          rows={4}
                          value={activeAnswer.review?.remark ?? ''}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-300">Pilih pertanyaan untuk detail.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-[#0b1736] dark:shadow-[0_24px_60px_rgba(2,8,28,0.55)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Protocol Question (PQ)
              </h1>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" />
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <span>{scopeLabel}</span>
              <span>/</span>
              <span className="font-semibold text-blue-600">
                Protocol Question (PQ)
              </span>
            </div>
          </div>
        </header>

        <div className="bg-blue-50/60 px-6 py-6 dark:bg-[#0d214f]">
          <section className="overflow-hidden rounded-2xl border border-blue-100/60 bg-white shadow-sm dark:border-slate-700 dark:bg-[#132754]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    Data Hasil Review Unit Safety
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Lihat dan kelola data hasil review Unit Safety Protocol Question (PQ).
                  </p>
                </div>
              </div>
              <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                {badgeLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 px-6 py-5">
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
                className="h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/50 sm:w-32"
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
                  placeholder="Cari area / ketua tim..."
                />
              </div>
              <Button
                type="button"
                className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
                onClick={loadItems}
              >
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                onClick={resetFilters}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="px-6 pb-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60">
                <Table className="w-full">
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-800/70">
                    <TableRow>
                      <TableHead
                        rowSpan={2}
                        className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300"
                      >
                        No
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300"
                      >
                        Area
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300"
                      >
                        Ketua Tim
                      </TableHead>
                      <TableHead
                        colSpan={2}
                        className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300"
                      >
                        Anggota
                      </TableHead>
                      <TableHead
                        rowSpan={2}
                        className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300"
                      >
                        Tanggal Pelaksanaan
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                        Anggota
                      </TableHead>
                      <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                        Auditee
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-16">
                          <div className="flex flex-col items-center gap-3 text-center text-slate-500 dark:text-slate-300">
                            <div className="relative">
                              <FolderOpen className="h-16 w-16 text-blue-200" />
                              <Search className="absolute bottom-1 right-0 h-6 w-6 rounded-full bg-blue-100 p-1 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                              <div className="text-base font-semibold text-slate-700 dark:text-slate-100">
                                Belum ada data
                              </div>
                              <div className="text-sm text-slate-500 dark:text-slate-300">
                                Coba ubah filter bulan/tahun atau reset filter
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
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
                        <TableRow key={item.sessionAreaId}>
                          <TableCell className="text-center text-sm">{index + 1}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                              onClick={() =>
                                openDetail({
                                  sessionAreaId: item.sessionAreaId,
                                  area: item.area,
                                  schedule: item.schedule,
                                })
                              }
                            >
                              {item.area}
                            </Button>
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
                          <TableCell className="text-center text-sm text-slate-500 dark:text-slate-300">
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
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
