import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ClipboardCheck, RefreshCw, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { resolveApiUrl } from '@/lib/api';
import {
  deleteSelfAssessmentResultFile,
  fetchAdminSelfAssessmentSubmissionDetail,
  fetchAdminSelfAssessmentSubmissions,
  finalizeSelfAssessmentResult,
  submitAdminSelfAssessmentReviews,
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
const SCOPE_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'audit', label: 'Audit' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'inspeksi', label: 'Inspeksi' },
  { value: 'surveillance', label: 'Surveillance' },
];

const parseScheduleReleaseTime = (schedule: string | null) => {
  if (!schedule) return 0;
  const dateMatches = schedule.match(/\d{4}-\d{2}-\d{2}/g);
  const rawReleaseDate = dateMatches?.[0] ?? schedule.trim();
  if (!rawReleaseDate) return 0;
  const parsed = new Date(rawReleaseDate).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatScheduleDisplay = (schedule: string | null, fallback = '-') => {
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

type SelfAssessmentReviewsProps = {
  initialScope?: SelfAssessmentScope | 'all';
  lockScope?: boolean;
  hideScopeFilter?: boolean;
  title?: string;
  description?: string;
  reviewLabel?: string;
};

type SubmissionSummary = {
  sessionAreaId: string;
  user: { id: string; name: string; email?: string } | null;
  area: string;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  questionCount: number;
  submittedAt: string | null;
};

type SubmissionDetail = {
  sessionAreaId: string;
  area: string;
  scope: string;
  schedule: string | null;
  team: { leader: string; dnp: string[]; kobo: string[] } | null;
  totalQuestions?: number;
  result: {
    id: string;
    status: string;
    finalizedAt: string | null;
    files: Array<{ id: string; name: string; url: string }>;
  } | null;
  answers: Array<{
    id: string;
    questionCode: string;
    questionText: string;
    reference: string | null;
    status: string;
    comment: string | null;
    submittedAt: string | null;
    isSubmitted?: boolean;
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
};

export function SelfAssessmentReviews({
  initialScope = 'all',
  lockScope = false,
  hideScopeFilter = false,
  title = 'Review Unit Safety Self Assessment',
  description = 'Lihat data kirim self assessment dan beri review.',
  reviewLabel = 'Review Unit Safety',
}: SelfAssessmentReviewsProps) {
  const [searchParams] = useSearchParams();
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
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionSummary | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [reviewInputs, setReviewInputs] = useState<
    Record<
      string,
      {
        status: string;
        comment: string;
        severity: string;
        probability: string;
        resume: string;
        description: string;
        finding: string;
        recommendations: string;
        remark: string;
      }
    >
  >({});
  const [sendMode, setSendMode] = useState<'finalize' | 'allow'>('finalize');
  const [finalizeStatus, setFinalizeStatus] = useState<'interim' | 'final'>(
    'interim'
  );
  const [finalizeFiles, setFinalizeFiles] = useState<File[]>([]);
  const finalizeFileInputRef = useRef<HTMLInputElement | null>(null);
  const [forceSendResult, setForceSendResult] = useState(false);
  const [isDeletingResultFile, setIsDeletingResultFile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);

  const filteredSubmissions = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const source = term
      ? submissions.filter((item) =>
          `${item.area} ${item.leader} ${item.user?.name ?? ''}`
            .toLowerCase()
            .includes(term)
        )
      : submissions;

    return [...source].sort((a, b) => {
      const scheduleDiff =
        parseScheduleReleaseTime(b.schedule) - parseScheduleReleaseTime(a.schedule);
      if (scheduleDiff !== 0) return scheduleDiff;
      const submittedA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const submittedB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return submittedB - submittedA;
    });
  }, [submissions, searchText]);

  const loadSubmissions = () => {
    setIsLoading(true);
    fetchAdminSelfAssessmentSubmissions({
      scope: scope === 'all' ? undefined : (scope as SelfAssessmentScope),
      month: month === 'ALL' ? undefined : month,
      year,
    })
      .then((items) => {
        setSubmissions(items);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadSubmissions();
  }, [scope, month, year]);

  useEffect(() => {
    if (lockScope) {
      setScope(resolvedInitialScope);
      return;
    }
    const param = searchParams.get('scope') as SelfAssessmentScope | 'all' | null;
    if (
      param &&
      SCOPE_OPTIONS.some((option) => option.value === param) &&
      param !== scope
    ) {
      setScope(param);
    }
  }, [searchParams, scope, lockScope, resolvedInitialScope]);

  useEffect(() => {
    if (autoSelected) return;
    const sessionAreaId = searchParams.get('sessionAreaId');
    const userId = searchParams.get('userId');
    if (!sessionAreaId || !userId || submissions.length === 0) {
      return;
    }
    const target = submissions.find(
      (item) =>
        item.sessionAreaId === sessionAreaId && item.user?.id === userId
    );
    if (target) {
      setAutoSelected(true);
      handleSelect(target);
    }
  }, [autoSelected, submissions, searchParams]);

  const loadDetail = (submission: SubmissionSummary) => {
    if (!submission.user) {
      return;
    }
    setIsLoading(true);
    fetchAdminSelfAssessmentSubmissionDetail({
      sessionAreaId: submission.sessionAreaId,
      userId: submission.user.id,
    })
      .then((data) => {
        setDetail(data);
        setActiveAnswerId(data.answers[0]?.id ?? null);
        setFinalizeStatus(
          data.result?.status === 'final' ? 'final' : 'interim'
        );
        setFinalizeFiles([]);
        if (finalizeFileInputRef.current) {
          finalizeFileInputRef.current.value = '';
        }
        const nextInputs: Record<
          string,
          {
            status: string;
            comment: string;
            severity: string;
            probability: string;
            resume: string;
            description: string;
            finding: string;
            recommendations: string;
            remark: string;
          }
        > = {};
        data.answers.forEach((answer) => {
          nextInputs[answer.id] = {
            status: answer.review?.status ?? answer.status,
            comment: answer.review?.comment ?? answer.review?.description ?? '',
            severity: answer.review?.severity ?? '',
            probability: answer.review?.probability ?? '',
            resume: answer.review?.resume ?? '',
            description: answer.review?.description ?? answer.review?.comment ?? '',
            finding: answer.review?.finding ?? '',
            recommendations: answer.review?.recommendations ?? '',
            remark: answer.review?.remark ?? '',
          };
        });
        setReviewInputs(nextInputs);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat detail',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  };

  const handleSelect = (submission: SubmissionSummary) => {
    setSelectedSubmission(submission);
    loadDetail(submission);
  };

  const activeAnswer = detail?.answers.find((answer) => answer.id === activeAnswerId);

  const handleReviewChange = (
    answerId: string,
    value: Partial<{
      status: string;
      comment: string;
      severity: string;
      probability: string;
      resume: string;
      description: string;
      finding: string;
      recommendations: string;
      remark: string;
    }>
  ) => {
    setReviewInputs((prev) => ({
      ...prev,
      [answerId]: {
        status: value.status ?? prev[answerId]?.status ?? 'Satisfactory',
        comment: value.comment ?? prev[answerId]?.comment ?? '',
        severity: value.severity ?? prev[answerId]?.severity ?? '',
        probability: value.probability ?? prev[answerId]?.probability ?? '',
        resume: value.resume ?? prev[answerId]?.resume ?? '',
        description: value.description ?? prev[answerId]?.description ?? '',
        finding: value.finding ?? prev[answerId]?.finding ?? '',
        recommendations: value.recommendations ?? prev[answerId]?.recommendations ?? '',
        remark: value.remark ?? prev[answerId]?.remark ?? '',
      },
    }));
  };

  const submitReviews = (answerIds: string[], action: 'draft' | 'send') => {
    if (!detail) {
      return;
    }
    const items = answerIds.map((answerId) => ({
      answerId,
      status: reviewInputs[answerId]?.status ?? 'Satisfactory',
      comment: reviewInputs[answerId]?.comment ?? '',
      severity: reviewInputs[answerId]?.severity ?? '',
      probability: reviewInputs[answerId]?.probability ?? '',
      resume: reviewInputs[answerId]?.resume ?? '',
      description:
        reviewInputs[answerId]?.description ?? reviewInputs[answerId]?.comment ?? '',
      finding: reviewInputs[answerId]?.finding ?? '',
      recommendations: reviewInputs[answerId]?.recommendations ?? '',
      remark: reviewInputs[answerId]?.remark ?? '',
    }));
    setIsSaving(true);
    submitAdminSelfAssessmentReviews({
      items,
      action,
      allowReply: action === 'send' ? sendMode === 'allow' : false,
    })
      .then(() => {
        toast({
          title: 'Review tersimpan',
          description:
            action === 'send' ? 'Review dikirim ke user.' : 'Review disimpan sebagai draft.',
        });
      })
      .then(() => {
        if (selectedSubmission) {
          loadDetail(selectedSubmission);
        }
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal menyimpan review',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSaving(false));
  };

  const handleSendResult = async () => {
    if (!detail || !selectedSubmission?.user) {
      return;
    }
    const totalQuestions = detail.totalQuestions ?? detail.answers.length;
    const submittedCount = detail.answers.filter(
      (answer) => answer.isSubmitted || !!answer.submittedAt
    ).length;
    const reviewedCount = detail.answers.filter((answer) => !!answer.review?.sentAt).length;
    const isComplete = submittedCount === totalQuestions && reviewedCount >= submittedCount;
    if (!isComplete && !forceSendResult) {
      toast({
        title: 'Belum lengkap',
        description: 'Centang opsi kirim walau belum lengkap untuk melanjutkan.',
      });
      return;
    }
    if (!finalizeStatus) {
      toast({
        title: 'Status hasil wajib dipilih',
        description: 'Pilih status hasil sebelum mengirim.',
      });
      return;
    }
    if (finalizeFiles.length === 0) {
      toast({
        title: 'Upload document wajib',
        description: 'Mohon unggah minimal 1 dokumen.',
      });
      return;
    }

    const draftAnswerIds = detail.answers
      .filter((answer) => answer.review && !answer.review.sentAt)
      .map((answer) => answer.id);

    setIsSaving(true);
    try {
      if (draftAnswerIds.length > 0) {
        const items = draftAnswerIds.map((answerId) => ({
          answerId,
          status: reviewInputs[answerId]?.status ?? 'Satisfactory',
          comment: reviewInputs[answerId]?.comment ?? '',
          severity: reviewInputs[answerId]?.severity ?? '',
          probability: reviewInputs[answerId]?.probability ?? '',
          resume: reviewInputs[answerId]?.resume ?? '',
          description:
            reviewInputs[answerId]?.description ?? reviewInputs[answerId]?.comment ?? '',
          finding: reviewInputs[answerId]?.finding ?? '',
          recommendations: reviewInputs[answerId]?.recommendations ?? '',
          remark: reviewInputs[answerId]?.remark ?? '',
        }));
        await submitAdminSelfAssessmentReviews({
          items,
          action: 'send',
          allowReply: false,
        });
      }

      await finalizeSelfAssessmentResult({
        sessionAreaId: selectedSubmission.sessionAreaId,
        userId: selectedSubmission.user.id,
        status: finalizeStatus,
        files: finalizeFiles,
        replaceFiles: true,
      });

      toast({
        title: 'Hasil dikirim',
        description: 'Dokumen hasil audit berhasil dikirim ke user.',
      });
      setFinalizeFiles([]);
      if (finalizeFileInputRef.current) {
        finalizeFileInputRef.current.value = '';
      }
      setForceSendResult(false);
      loadDetail(selectedSubmission);
    } catch (error) {
      toast({
        title: 'Gagal mengirim hasil',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (detail && selectedSubmission) {
    const totalQuestions = detail.totalQuestions ?? detail.answers.length;
    const submittedCount = detail.answers.filter(
      (answer) => answer.isSubmitted || !!answer.submittedAt
    ).length;
    const reviewedCount = detail.answers.filter((answer) => !!answer.review?.sentAt).length;
    const isResultComplete =
      submittedCount === totalQuestions && reviewedCount >= submittedCount;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
              <p className="text-sm text-slate-500">
                {selectedSubmission.area} • {selectedSubmission.user?.name ?? '-'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setDetail(null);
              setSelectedSubmission(null);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Daftar Pertanyaan</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => submitReviews(detail.answers.map((item) => item.id), 'draft')}
                  disabled={isSaving}
                >
                  Simpan Draft
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => submitReviews(detail.answers.map((item) => item.id), 'send')}
                  disabled={isSaving}
                >
                  Kirim Semua
                </Button>
              </div>
            </div>
            <div className="space-y-2 text-xs text-slate-500">
              <div>Scope: {detail.scope}</div>
              <div>Jadwal: {formatScheduleDisplay(detail.schedule, '-')}</div>
              <div>Ketua Tim: {detail.team?.leader ?? '-'}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-[#1e3a8a]">
                Direview {reviewedCount} / {submittedCount}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[#065f46]">
                Dikirim user {submittedCount} / {totalQuestions}
              </span>
            </div>
            <div className="overflow-hidden divide-y rounded-xl border border-slate-200">
              {detail.answers.map((answer) => {
                const isReviewSent = Boolean(answer.review?.sentAt);
                const isReviewDraft = Boolean(answer.review) && !isReviewSent;
                const rowTone = isReviewSent
                  ? 'bg-emerald-50 text-slate-900 hover:bg-amber-300 dark:bg-emerald-900/30 dark:text-slate-100 dark:hover:bg-amber-500/60'
                  : isReviewDraft
                  ? 'bg-amber-50 text-slate-900 hover:bg-amber-300 dark:bg-amber-900/30 dark:text-slate-100 dark:hover:bg-amber-500/60'
                  : 'text-slate-700 hover:bg-amber-300 dark:text-slate-200 dark:hover:bg-amber-500/60';
                const badgeTone = isReviewSent
                  ? 'bg-emerald-100 text-[#065f46]'
                  : 'bg-amber-100 text-[#92400e]';
                const badgeLabel = isReviewSent ? 'Dikirim' : 'Draft';
                const rowClass =
                  isReviewSent || isReviewDraft
                    ? rowTone
                    : activeAnswerId === answer.id
                    ? 'bg-blue-100 text-slate-900 dark:bg-blue-900/40 dark:text-slate-100'
                    : rowTone;
                return (
                <button
                  key={answer.id}
                  type="button"
                  className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition ${rowClass}`}
                  onClick={() => setActiveAnswerId(answer.id)}
                >
                  <span className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                    {answer.questionCode}
                  </span>
                  <span className="flex-1">{answer.questionText}</span>
                  {(isReviewSent || isReviewDraft) && (
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badgeTone}`}
                    >
                      {badgeLabel}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <div className="text-sm font-semibold text-slate-700">
                Pengiriman Document Final Hasil Audit
              </div>
              {!isResultComplete && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Hasil audit belum lengkap. Centang opsi di bawah jika ingin tetap
                  mengirim.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Status Hasil <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                    value={finalizeStatus}
                    onChange={(event) =>
                      setFinalizeStatus(
                        event.target.value === 'final' ? 'final' : 'interim'
                      )
                    }
                    disabled={!isResultComplete && !forceSendResult}
                  >
                    <option value="interim">Interim</option>
                    <option value="final">Final</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Upload Document <span className="text-red-500">*</span>
                  </label>
                  <Input
                    ref={finalizeFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                    onChange={(event) =>
                      setFinalizeFiles(Array.from(event.target.files ?? []))
                    }
                    disabled={!isResultComplete && !forceSendResult}
                  />
                </div>
              </div>
              {detail.result?.files?.length ? (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                  <div className="mb-2 font-semibold text-slate-700">
                    File tersimpan
                  </div>
                  <div className="space-y-2">
                    {detail.result.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <a
                          href={resolveApiUrl(file.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-blue-600 underline"
                        >
                          {file.name}
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-red-500 hover:text-red-600"
                          disabled={isDeletingResultFile}
                          onClick={async () => {
                            if (isDeletingResultFile) return;
                            setIsDeletingResultFile(true);
                            try {
                              await deleteSelfAssessmentResultFile(file.id);
                              setDetail((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      result: prev.result
                                        ? {
                                            ...prev.result,
                                            files: prev.result.files.filter(
                                              (item) => item.id !== file.id
                                            ),
                                          }
                                        : prev.result,
                                    }
                                  : prev
                              );
                              toast({
                                title: 'File dihapus',
                                description: 'File dokumen berhasil dihapus.',
                              });
                            } catch (error) {
                              toast({
                                title: 'Gagal menghapus file',
                                description:
                                  error instanceof Error && error.message
                                    ? error.message
                                    : 'Terjadi kesalahan.',
                              });
                            } finally {
                              setIsDeletingResultFile(false);
                            }
                          }}
                        >
                          Hapus
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <Checkbox
                  checked={forceSendResult}
                  onCheckedChange={(checked) => setForceSendResult(checked === true)}
                />
                <span>
                  Kirim hasil audit walaupun tidak lengkap.
                </span>
              </label>
              {forceSendResult && (
                <div className="text-xs text-slate-500">
                  Dengan mencentang box ini maka hasil akan tetap dikirim walaupun
                  user belum mengirim semua self assessment atau admin belum
                  mereview semua self assessment.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="bg-blue-500 text-white hover:bg-blue-600"
                  onClick={handleSendResult}
                  disabled={isSaving || (!isResultComplete && !forceSendResult)}
                >
                  Kirim Hasil Audit
                </Button>
                <div className="text-xs text-slate-500">
                  Format: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, ZIP.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {activeAnswer ? (
              <>
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Self Assessment
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    {activeAnswer.questionCode}
                  </div>
                  <div className="text-sm text-slate-600">{activeAnswer.questionText}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  {activeAnswer.comment || 'Belum ada komentar dari user.'}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Evidence
                  </div>
                  {activeAnswer.evidence.length === 0 ? (
                    <div className="text-sm text-slate-500">Belum ada evidence.</div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <ol className="list-decimal space-y-1 pl-4 text-sm text-blue-600">
                        {activeAnswer.evidence.map((item) => (
                          <li key={item.id}>
                            <a
                              href={resolveApiUrl(item.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block max-w-full break-all hover:underline"
                            >
                              {item.name}
                            </a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {reviewLabel}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Status of Implementation <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                        value={reviewInputs[activeAnswer.id]?.status ?? 'Satisfactory'}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, { status: event.target.value })
                        }
                      >
                        <option value="Satisfactory">Satisfactory</option>
                        <option value="Not Satisfactory">Not Satisfactory</option>
                        <option value="Not Aplicable">Not Aplicable</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Severity
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                        value={reviewInputs[activeAnswer.id]?.severity ?? ''}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, { severity: event.target.value })
                        }
                      >
                        <option value="">-</option>
                        <option value="Minor">Minor</option>
                        <option value="Major">Major</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Probability
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                        value={reviewInputs[activeAnswer.id]?.probability ?? ''}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, { probability: event.target.value })
                        }
                      >
                        <option value="">-</option>
                        <option value="Rare">Rare</option>
                        <option value="Occasional">Occasional</option>
                        <option value="Frequent">Frequent</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Resume
                      </label>
                      <Input
                        value={reviewInputs[activeAnswer.id]?.resume ?? ''}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, { resume: event.target.value })
                        }
                        placeholder="Ringkasan"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Description
                      </label>
                      <Textarea
                        rows={3}
                        value={reviewInputs[activeAnswer.id]?.description ?? ''}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, { description: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Finding
                      </label>
                      <Textarea
                        rows={3}
                        value={reviewInputs[activeAnswer.id]?.finding ?? ''}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, { finding: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Recommendations
                      </label>
                      <Textarea
                        rows={3}
                        value={reviewInputs[activeAnswer.id]?.recommendations ?? ''}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, {
                            recommendations: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Remark
                      </label>
                      <Textarea
                        rows={3}
                        value={reviewInputs[activeAnswer.id]?.remark ?? ''}
                        onChange={(event) =>
                          handleReviewChange(activeAnswer.id, { remark: event.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Mode Kirim
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                    value={sendMode}
                    onChange={(event) =>
                      setSendMode(event.target.value === 'allow' ? 'allow' : 'finalize')
                    }
                  >
                    <option value="finalize">Finalize</option>
                    <option value="allow">Allow Reply</option>
                  </select>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => submitReviews([activeAnswer.id], 'draft')}
                    disabled={isSaving}
                  >
                    Simpan Draft
                  </Button>
                  <Button
                    className="bg-blue-500 text-white hover:bg-blue-600"
                    onClick={() => submitReviews([activeAnswer.id], 'send')}
                    disabled={isSaving}
                  >
                    Kirim
                  </Button>
                </div>
                <div className="grid gap-3 pt-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Review By
                    </label>
                    <Input
                      value={activeAnswer.review?.reviewer?.name ?? '—'}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Review At
                    </label>
                    <Input value={activeAnswer.review?.sentAt ?? '—'} disabled />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Pilih pertanyaan untuk review.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
          <ClipboardCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {!hideScopeFilter && (
          <select
            className="h-11 rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100"
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as SelfAssessmentScope | 'all')
            }
            disabled={lockScope}
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        <select
          className="h-11 rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100"
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
          className="h-11 rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        >
          {YEAR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
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
          variant="outline"
          className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
          onClick={loadSubmissions}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reload
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">No</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Ketua Tim</TableHead>
              <TableHead>Anggota</TableHead>
              <TableHead>Audity</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="w-32 text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : filteredSubmissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  Belum ada data terkirim.
                </TableCell>
              </TableRow>
            ) : (
              filteredSubmissions.map((item, index) => (
                <TableRow key={`${item.sessionAreaId}-${item.user?.id ?? index}`}>
                  <TableCell className="text-center text-sm">{index + 1}</TableCell>
                  <TableCell className="text-sm">{item.area}</TableCell>
                  <TableCell className="text-sm">{item.user?.name ?? '-'}</TableCell>
                  <TableCell className="text-sm">{item.leader}</TableCell>
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
                  <TableCell className="text-sm text-slate-500">
                    {formatScheduleDisplay(item.schedule, '-')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 min-w-[96px] rounded-xl border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-100 dark:border-blue-700/70 dark:bg-blue-900/30 dark:text-blue-100 dark:hover:bg-blue-900/50"
                      onClick={() => handleSelect(item)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
