import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Circle, SendHorizontal } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { Modal } from '@/components/shared/Modal';
import { toast } from '@/hooks/use-toast';
import { resolveApiUrl } from '@/lib/api';
import {
  deleteMonitoringResultFile,
  fetchAdminSelfAssessmentCapFulfillmentDetail,
  finalizeMonitoringResult,
  submitAdminSelfAssessmentMonitoringReview,
} from '@/lib/selfAssessment';

type MonitoringReviewDetailData = {
  sessionAreaId: string;
  area: string;
  scope: string;
  schedule: string | null;
  team: { leader: string; dnp: string[]; kobo: string[] } | null;
  user?: { id: string; name: string; email?: string } | null;
  sentCaps?: number;
  totalCaps?: number;
  result?: {
    id: string;
    status: string;
    finalizedAt: string | null;
    files: Array<{ id: string; name: string; url: string }>;
  } | null;
  caps: Array<{
    id: string;
    answerId: string;
    questionCode: string | null;
    questionText: string;
    questionReference?: string | null;
    actionPlan: string | null;
    targetDate: string | null;
    selfAssessmentComment?: string | null;
    selfAssessmentEvidenceNote?: string | null;
    selfAssessmentCreatedAt?: string | null;
    selfAssessmentUpdatedAt?: string | null;
    selfAssessmentEvidenceFiles?: Array<{ id: string; name: string; url: string }>;
    review: {
      result: string | null;
      comment: string | null;
      status: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    monitoringReview?: {
      result: string | null;
      comment: string | null;
      status: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    fulfillmentReview?: {
      result: string | null;
      comment: string | null;
      status: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    selfAssessmentReview: {
      status: string;
      severity?: string | null;
      probability?: string | null;
      resume?: string | null;
      finding?: string | null;
      recommendations?: string | null;
      description?: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    fulfillments: Array<{
      id: string;
      step: number;
      proposeAction: string;
      actionOffice: string;
      evidenceReference: string | null;
      completeDate: string | null;
      progress: number;
      status: string;
      submittedAt: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
      files: Array<{ id: string; name: string; url: string }>;
    }>;
    extensions?: Array<{
      id: string;
      dueDate: string;
      fileName: string;
      fileUrl: string;
      status: string;
    }>;
  }>;
};

const CAP_REVIEW_STATUS_OPTIONS = [
  { value: 'Satisfactory', label: 'SATISFACTORY' },
  { value: 'Not Satisfactory', label: 'NOT SATISFACTORY' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 19);
};

const QUESTION_SECTION_LABELS: Record<string, string> = {
  A: 'ORGANISASI',
  B: 'PROSEDUR',
  C: 'PERSONEL',
};

const resolveQuestionSection = (questionCode?: string | null) => {
  const normalized = (questionCode ?? '').trim().toUpperCase();
  const match = normalized.match(/^([A-Z])/);
  return match?.[1] ?? '#';
};

const toReviewedBadgeLabel = (value?: string | null) => {
  if (!value) return 'Reviewed';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Reviewed';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `Reviewed ${day}/${month}/${year}`;
};

const isNotSatisfactoryStatus = (value?: string | null) => {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
  return normalized === 'not satisfactory';
};

const resolveQuestionProgress = (item: MonitoringCapItem) => {
  if (!item.fulfillments?.length) return 0;
  return Math.max(...item.fulfillments.map((entry) => entry.progress ?? 0));
};

const isClosedQuestion = (item: MonitoringCapItem) => {
  const implementationStatus =
    item.monitoringReview?.status ??
    item.monitoringReview?.result ??
    'Not Satisfactory';
  return Boolean(item.monitoringReview?.reviewedAt) && !isNotSatisfactoryStatus(implementationStatus);
};

const resolveQuestionState = (item: MonitoringCapItem) => {
  if (isClosedQuestion(item)) return 'closed';
  if (item.monitoringReview && !item.monitoringReview.reviewedAt) return 'draft';
  const progress = resolveQuestionProgress(item);
  return progress >= 100 ? 'new-100' : 'new-under-100';
};

const resolveQuestionRowClass = (state: string, isActive: boolean) => {
  const activeBlueRow =
    'bg-blue-100 text-slate-900 font-semibold dark:bg-blue-900/40 dark:text-slate-100';
  if (state === 'closed') {
    return isActive
      ? 'bg-emerald-100 text-slate-900 font-semibold dark:bg-[#0f3f46] dark:text-slate-100'
      : 'bg-emerald-50 text-slate-900 hover:bg-amber-300 dark:bg-[#0d3a40] dark:text-slate-100 dark:hover:bg-amber-500/60';
  }
  if (state === 'draft') {
    return isActive
      ? 'bg-amber-100 text-slate-900 font-semibold dark:bg-[#3a3324] dark:text-slate-100'
      : 'bg-amber-50 text-slate-900 hover:bg-amber-300 dark:bg-[#342f23] dark:text-slate-100 dark:hover:bg-amber-500/60';
  }
  if (state === 'new-100') {
    return isActive
      ? activeBlueRow
      : 'bg-white text-slate-900 hover:bg-amber-300 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-amber-500/60';
  }
  return isActive
    ? 'bg-red-50 text-slate-900 font-semibold dark:bg-red-900/25 dark:text-slate-100'
    : 'bg-red-50 text-slate-900 hover:bg-amber-300 dark:bg-red-900/25 dark:text-slate-100 dark:hover:bg-amber-500/60';
};

type FulfillmentHistoryItem = {
  id: string;
  step: number;
  proposeAction: string;
  actionOffice: string;
  evidenceReference: string | null;
  progress: number;
  status: string;
  submittedAt: string | null;
  fileCount: number;
};

type ReviewHistoryItem = {
  id: string;
  source: string;
  status: string;
  remark: string;
  reviewedBy: string;
  reviewedAt: string | null;
};

type MonitoringCapItem = MonitoringReviewDetailData['caps'][number];

export function MonitoringReviewDetail() {
  const { sessionAreaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get('userId') ?? '';

  const [detail, setDetail] = useState<MonitoringReviewDetailData | null>(null);
  const [activeCapId, setActiveCapId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [reviewStatus, setReviewStatus] = useState('Not Satisfactory');
  const [reviewComment, setReviewComment] = useState('');
  const [resultFiles, setResultFiles] = useState<File[]>([]);
  const resultFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isSendingResult, setIsSendingResult] = useState(false);
  const [isDeletingResultFile, setIsDeletingResultFile] = useState(false);
  const [isFulfillmentHistoryOpen, setIsFulfillmentHistoryOpen] = useState(false);
  const [isReviewHistoryOpen, setIsReviewHistoryOpen] = useState(false);

  const activeItem = useMemo(
    () => detail?.caps.find((item) => item.id === activeCapId) ?? null,
    [detail, activeCapId]
  );

  const filteredCaps = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) {
      return detail?.caps ?? [];
    }
    return (detail?.caps ?? []).filter((item) =>
      `${item.questionCode ?? ''} ${item.questionText}`.toLowerCase().includes(term)
    );
  }, [detail?.caps, searchText]);
  const groupedFilteredCaps = useMemo(() => {
    const grouped = new Map<string, MonitoringCapItem[]>();
    filteredCaps.forEach((item) => {
      const section = resolveQuestionSection(item.questionCode);
      const current = grouped.get(section) ?? [];
      current.push(item);
      grouped.set(section, current);
    });
    return Array.from(grouped.entries());
  }, [filteredCaps]);
  const detailSummary = useMemo(() => {
    const total = filteredCaps.length;
    const closed = filteredCaps.reduce((count, item) => (isClosedQuestion(item) ? count + 1 : count), 0);
    return {
      total,
      closed,
      open: Math.max(0, total - closed),
    };
  }, [filteredCaps]);
  const latestFulfillment = useMemo(() => {
    if (!activeItem?.fulfillments?.length) return null;
    return [...activeItem.fulfillments].sort((a, b) => {
      const dateA = new Date(
        a.submittedAt ?? a.updatedAt ?? a.createdAt ?? '1970-01-01T00:00:00'
      ).getTime();
      const dateB = new Date(
        b.submittedAt ?? b.updatedAt ?? b.createdAt ?? '1970-01-01T00:00:00'
      ).getTime();
      return dateB - dateA;
    })[0];
  }, [activeItem]);

  const latestExtension = useMemo(() => {
    if (!activeItem?.extensions?.length) return null;
    return [...activeItem.extensions].sort((a, b) => {
      const dateA = new Date(a.dueDate ?? '1970-01-01').getTime();
      const dateB = new Date(b.dueDate ?? '1970-01-01').getTime();
      return dateB - dateA;
    })[0];
  }, [activeItem]);
  const activeFulfillmentProgress = Math.max(
    0,
    Math.min(100, latestFulfillment?.progress ?? 0)
  );
  const activeReviewSubmitted = Boolean(activeItem?.monitoringReview?.reviewedAt);
  const activeReviewStatus =
    activeItem?.monitoringReview?.status ??
    activeItem?.monitoringReview?.result ??
    'Not Satisfactory';
  const activeInfoText = activeReviewSubmitted
    ? `CAP sudah memiliki pemenuhan sebesar ${activeFulfillmentProgress}% dan sudah direview dengan status ${activeReviewStatus}.`
    : `CAP sudah memiliki pemenuhan sebesar ${activeFulfillmentProgress}%.`;

  const fileEvidence = useMemo(() => {
    if (!activeItem) return [] as Array<{ id: string; name: string; url: string }>;
    return activeItem.selfAssessmentEvidenceFiles ?? [];
  }, [activeItem]);

  const fulfillmentHistory = useMemo(() => {
    if (!activeItem?.fulfillments?.length) return [] as FulfillmentHistoryItem[];
    return activeItem.fulfillments
      .slice()
      .sort((a, b) => {
        const dateA = new Date(
          a.submittedAt ?? a.updatedAt ?? a.createdAt ?? '1970-01-01T00:00:00'
        ).getTime();
        const dateB = new Date(
          b.submittedAt ?? b.updatedAt ?? b.createdAt ?? '1970-01-01T00:00:00'
        ).getTime();
        if (dateA === dateB) return b.step - a.step;
        return dateB - dateA;
      })
      .map((item) => ({
        id: item.id,
        step: item.step,
        proposeAction: item.proposeAction,
        actionOffice: item.actionOffice,
        evidenceReference: item.evidenceReference,
        progress: item.progress,
        status: item.status,
        submittedAt: item.submittedAt ?? item.updatedAt ?? item.createdAt ?? null,
        fileCount: item.files.length,
      }));
  }, [activeItem]);

  const reviewHistory = useMemo(() => {
    if (!activeItem) return [] as ReviewHistoryItem[];
    const entries: ReviewHistoryItem[] = [];
    if (activeItem.selfAssessmentReview) {
      entries.push({
        id: `${activeItem.id}-self-assessment`,
        source: 'Self Assessment',
        status: activeItem.selfAssessmentReview.status ?? '-',
        remark:
          activeItem.selfAssessmentReview.description ??
          activeItem.selfAssessmentReview.resume ??
          activeItem.selfAssessmentReview.finding ??
          '-',
        reviewedBy: activeItem.selfAssessmentReview.reviewedBy?.name ?? '-',
        reviewedAt: activeItem.selfAssessmentReview.reviewedAt ?? null,
      });
    }
    if (activeItem.monitoringReview) {
      entries.push({
        id: `${activeItem.id}-monitoring-review`,
        source: 'Review Monitoring',
        status: activeItem.monitoringReview.status ?? activeItem.monitoringReview.result ?? '-',
        remark: activeItem.monitoringReview.comment ?? '-',
        reviewedBy: activeItem.monitoringReview.reviewedBy?.name ?? '-',
        reviewedAt: activeItem.monitoringReview.reviewedAt ?? null,
      });
    }
    return entries.sort((a, b) => {
      const dateA = new Date(a.reviewedAt ?? '1970-01-01T00:00:00').getTime();
      const dateB = new Date(b.reviewedAt ?? '1970-01-01T00:00:00').getTime();
      return dateB - dateA;
    });
  }, [activeItem]);


  const loadDetail = () => {
    if (!sessionAreaId || !userId) {
      setDetail(null);
      return;
    }
    setIsLoading(true);
    fetchAdminSelfAssessmentCapFulfillmentDetail({ sessionAreaId, userId })
      .then((data) => {
        setDetail(data);
        setActiveCapId((prev) => prev ?? data.caps[0]?.id ?? null);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat review monitoring',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAreaId, userId]);

  useEffect(() => {
    setReviewStatus(activeItem?.monitoringReview?.status ?? 'Not Satisfactory');
    setReviewComment(activeItem?.monitoringReview?.comment ?? '');
  }, [activeItem]);

  const handleSubmitReview = async (action: 'draft' | 'send') => {
    if (!activeItem) return;
    setIsSavingReview(true);
    try {
      await submitAdminSelfAssessmentMonitoringReview({
        capId: activeItem.id,
        status: reviewStatus || undefined,
        result: reviewStatus || undefined,
        comment: reviewComment.trim() ? reviewComment : undefined,
        action,
      });
      toast({
        title:
          action === 'send'
            ? 'Review Unit Safety dikirim'
            : 'Review Unit Safety disimpan',
        description:
          action === 'send'
            ? 'Review monitoring berhasil dikirim ke user.'
            : 'Review monitoring tersimpan sebagai draft.',
      });
      loadDetail();
    } catch (error) {
      toast({
        title: 'Gagal menyimpan review',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleSendResult = async () => {
    if (!sessionAreaId || !userId) return;
    if (resultFiles.length === 0) {
      toast({
        title: 'Upload dokumen wajib',
        description: 'Mohon pilih minimal 1 file hasil monitoring.',
      });
      return;
    }
    setIsSendingResult(true);
    try {
      const response = await finalizeMonitoringResult({
        sessionAreaId,
        userId,
        status: 'final',
        files: resultFiles,
        replaceFiles: false,
      });
      setDetail((prev) =>
        prev
          ? {
            ...prev,
            result: {
              id: response.id,
              status: response.status,
              finalizedAt: response.finalizedAt,
              files: response.files,
            },
          }
          : prev
      );
      setResultFiles([]);
      if (resultFileInputRef.current) {
        resultFileInputRef.current.value = '';
      }
      toast({
        title: 'Hasil monitoring dikirim',
        description: 'User sudah bisa melihat hasil monitoring terbaru.',
      });
    } catch (error) {
      toast({
        title: 'Gagal mengirim hasil',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSendingResult(false);
    }
  };

  const handleDeleteResultFile = async (fileId: string) => {
    if (isDeletingResultFile) return;
    setIsDeletingResultFile(true);
    try {
      await deleteMonitoringResultFile(fileId);
      setDetail((prev) =>
        prev
          ? {
            ...prev,
            result: prev.result
              ? {
                ...prev.result,
                files: prev.result.files.filter((item) => item.id !== fileId),
              }
              : prev.result,
          }
          : prev
      );
      toast({
        title: 'File hasil dihapus',
        description: 'File hasil monitoring berhasil dihapus.',
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
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Admin / Monitoring
            </p>
            <h1 className="text-lg font-semibold text-slate-800">
              Review Monitoring Self Assessment
            </h1>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/admin/monitoring-reviews')}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
        </header>

        <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">LIST PROTOCOL QUESTION</h2>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Search:</span>
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search..."
                className="h-8 max-w-xs text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-red-100 px-3 py-1 text-[#991b1b]">
                Not Satisfactory {detailSummary.open} / {detailSummary.total}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                Satisfactory {detailSummary.closed} / {detailSummary.total}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                {detail?.area ?? 'Area Monitoring'}
              </div>

              {isLoading ? (
                <div className="px-3 py-4 text-sm text-slate-500">Memuat data...</div>
              ) : groupedFilteredCaps.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">
                  Belum ada data protocol question.
                </div>
              ) : (
                groupedFilteredCaps.map(([section, sectionItems], index) => (
                  <div
                    key={section}
                    className={index < groupedFilteredCaps.length - 1 ? 'border-b border-slate-200' : ''}
                  >
                    <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                      {section} - {QUESTION_SECTION_LABELS[section] ?? 'LAINNYA'}
                    </div>
                    <div className="divide-y divide-slate-200">
                      {sectionItems.map((item) => {
                        const rowState = resolveQuestionState(item);
                        const isClosedItem = rowState === 'closed';
                        const isActive = activeCapId === item.id;
                        const progress = resolveQuestionProgress(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveCapId(item.id)}
                            className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition-colors ${resolveQuestionRowClass(
                              rowState,
                              isActive
                            )}`}
                          >
                            <span className="mt-1 inline-flex h-4 w-4 items-center justify-center">
                              {isClosedItem ? (
                                <Check className="h-3 w-3 text-slate-500 dark:text-slate-200" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </span>
                            <div className="flex-1">
                              <span className="font-semibold">{item.questionCode ?? '-'}</span>{' '}
                              - {item.questionText || '-'}
                              {isClosedItem && (
                                <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-300">
                                  {toReviewedBadgeLabel(item.monitoringReview?.reviewedAt)}
                                </div>
                              )}
                            </div>
                            <span
                              className={`mt-0.5 inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ${
                                progress >= 100
                                  ? 'bg-[#b8f0dc] text-[#0f5a49]'
                                  : 'bg-red-100 text-[#991b1b]'
                              }`}
                            >
                              {progress}%
                            </span>
                            <span
                              className={`mt-0.5 inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ${
                                isClosedItem
                                  ? 'bg-[#b8f0dc] text-[#0f5a49]'
                                  : 'bg-red-100 text-[#991b1b]'
                              }`}
                            >
                              {isClosedItem ? 'Closed' : 'Open'}
                            </span>
                            <SendHorizontal className="mt-1 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">
                Kirim Hasil Monitoring ke User
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">
                  Upload Document <span className="text-red-500">*</span>
                </label>
                <Input
                  ref={resultFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                  onChange={(event) => {
                    const selected = Array.from(event.target.files ?? []);
                    setResultFiles((prev) => {
                      const seen = new Set(prev.map((file) => `${file.name}-${file.size}`));
                      const next = [...prev];
                      selected.forEach((file) => {
                        const key = `${file.name}-${file.size}`;
                        if (!seen.has(key)) {
                          next.push(file);
                          seen.add(key);
                        }
                      });
                      return next;
                    });
                    event.currentTarget.value = '';
                  }}
                  disabled={isSendingResult}
                />
              </div>

              {resultFiles.length > 0 ? (
                <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-600">
                    File terpilih ({resultFiles.length})
                  </div>
                  {resultFiles.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-slate-700">{file.name}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() =>
                          setResultFiles((prev) =>
                            prev.filter((_, fileIndex) => fileIndex !== index)
                          )
                        }
                        disabled={isSendingResult}
                      >
                        Hapus
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {detail?.result?.files?.length ? (
                <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-600">
                    File tersimpan
                  </div>
                  {detail.result.files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-2">
                      <a
                        href={resolveApiUrl(file.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm text-blue-600 underline"
                      >
                        {file.name}
                      </a>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteResultFile(file.id)}
                        disabled={isDeletingResultFile}
                      >
                        Hapus
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="bg-blue-500 text-white hover:bg-blue-600"
                  onClick={handleSendResult}
                  disabled={isSendingResult || !sessionAreaId || !userId}
                >
                  {isSendingResult ? 'Mengirim...' : 'Kirim Hasil Monitoring'}
                </Button>
                <span className="text-xs text-slate-500">
                  Format: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, ZIP.
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="text-slate-500">{activeInfoText}</span>
              <span className="text-slate-500">Ket :</span>
              <span
                className={`rounded-md px-2 py-1 ${
                  activeReviewSubmitted && !isNotSatisfactoryStatus(activeReviewStatus)
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-[#991b1b]'
                }`}
              >
                {activeReviewSubmitted && !isNotSatisfactoryStatus(activeReviewStatus)
                  ? 'Satisfactory / Closed'
                  : 'Not Satisfactory / Open'}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">
                  &gt;Temuan Kegiatan Sebelumnya
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-amber-500 px-3 text-xs text-white hover:bg-amber-600"
                  onClick={() => setIsFulfillmentHistoryOpen(true)}
                  disabled={!activeItem || fulfillmentHistory.length === 0}
                >
                  History Pemenuhan CAP
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Temuan</label>
                  <Textarea
                    rows={4}
                    readOnly
                    value={activeItem?.selfAssessmentReview?.finding ?? '-'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Current Mitigation
                  </label>
                  <Textarea
                    rows={4}
                    readOnly
                    value={latestFulfillment?.proposeAction ?? activeItem?.actionPlan ?? '-'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Remark</label>
                  <Textarea
                    rows={3}
                    readOnly
                    value={latestFulfillment?.actionOffice ?? activeItem?.monitoringReview?.comment ?? '-'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Due Date</label>
                  <Input
                    readOnly
                    value={latestFulfillment?.completeDate ?? activeItem?.targetDate ?? '-'}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">Self Assessment</div>
              <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">
                        Protocol Question
                      </label>
                      <Textarea
                        rows={4}
                        readOnly
                        value={
                          activeItem
                            ? `${activeItem.questionCode ?? '-'} - ${activeItem.questionText}`
                            : '-'
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Comment</label>
                      <Textarea
                        rows={4}
                        readOnly
                        value={
                          activeItem?.selfAssessmentComment ??
                          activeItem?.selfAssessmentReview?.description ??
                          '-'
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">
                        Referensi Regulasi
                      </label>
                      <Textarea
                        rows={3}
                        readOnly
                        value={activeItem?.questionReference ?? '-'}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Evidence</label>
                      <Textarea
                        rows={3}
                        readOnly
                        value={activeItem?.selfAssessmentEvidenceNote ?? '-'}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Status Of Implementation
                    </label>
                    <Input readOnly value={activeItem?.selfAssessmentReview?.status ?? '-'} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Created By</label>
                    <Input readOnly value={detail?.user?.name ?? '-'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Created At</label>
                    <Input
                      readOnly
                      value={formatDateTime(activeItem?.selfAssessmentCreatedAt)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Edited By</label>
                    <Input readOnly value={detail?.user?.name ?? '-'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Last Modified</label>
                    <Input
                      readOnly
                      value={formatDateTime(activeItem?.selfAssessmentUpdatedAt)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-sm font-semibold text-slate-700">File evidence</div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-16 text-center text-xs">NO</TableHead>
                        <TableHead className="text-xs">FILENAME</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileEvidence.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-xs text-slate-500">
                            Tidak ada file evidence.
                          </TableCell>
                        </TableRow>
                      ) : (
                        fileEvidence.map((file, index) => (
                          <TableRow key={file.id}>
                            <TableCell className="text-center text-xs">{index + 1}</TableCell>
                            <TableCell className="text-xs text-blue-600">
                              <a
                                href={resolveApiUrl(file.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline"
                              >
                                {file.name}
                              </a>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Review Unit Safety</div>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-amber-500 px-3 text-xs text-white hover:bg-amber-600"
                  onClick={() => setIsReviewHistoryOpen(true)}
                  disabled={!activeItem || reviewHistory.length === 0}
                >
                  History Review
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1 md:col-span-1">
                  <label className="text-xs font-medium text-slate-600">
                    Status Of Implementation
                  </label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                    value={reviewStatus}
                    onChange={(event) => setReviewStatus(event.target.value)}
                  >
                    {CAP_REVIEW_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-1">
                  <label className="text-xs font-medium text-slate-600">Remark</label>
                  <Textarea
                    rows={3}
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Review By</label>
                    <Input readOnly value={activeItem?.monitoringReview?.reviewedBy?.name ?? '-'} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Review At</label>
                    <Input readOnly value={formatDateTime(activeItem?.monitoringReview?.reviewedAt)} />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSavingReview || !activeItem}
                  onClick={() => handleSubmitReview('draft')}
                >
                  Simpan Draft
                </Button>
                <Button
                  type="button"
                  className="bg-blue-500 text-white hover:bg-blue-600"
                  disabled={isSavingReview || !activeItem}
                  onClick={() => handleSubmitReview('send')}
                >
                  Kirim Review
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">Perpanjangan CAP</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Due Date</label>
                  <Input readOnly value={latestExtension?.dueDate ?? ''} placeholder="mm/dd/yyyy" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">File</label>
                  {latestExtension?.fileUrl ? (
                    <a
                      href={resolveApiUrl(latestExtension.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-blue-600 underline"
                    >
                      {latestExtension.fileName}
                    </a>
                  ) : (
                    <Input readOnly value="-" />
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Modal
        open={isFulfillmentHistoryOpen}
        onOpenChange={setIsFulfillmentHistoryOpen}
        title="History Pemenuhan CAP"
        description={
          activeItem
            ? `${activeItem.questionCode ?? '-'} - ${activeItem.questionText}`
            : 'Pilih CAP untuk melihat history.'
        }
        className="w-[96vw] sm:max-w-[1400px]"
      >
        {fulfillmentHistory.length === 0 ? (
          <div className="py-4 text-sm text-slate-500">
            Belum ada history pemenuhan CAP.
          </div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-16 text-center">Step</TableHead>
                  <TableHead>Propose Action</TableHead>
                  <TableHead>Action Office</TableHead>
                  <TableHead className="w-24 text-center">Progress</TableHead>
                  <TableHead className="w-24 text-center">File</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-40">Submitted At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fulfillmentHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-center">{item.step}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{item.proposeAction || '-'}</div>
                        <div className="text-xs text-slate-500">
                          Evidence: {item.evidenceReference ?? '-'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{item.actionOffice || '-'}</TableCell>
                    <TableCell className="text-center">{item.progress}%</TableCell>
                    <TableCell className="text-center">{item.fileCount}</TableCell>
                    <TableCell className="text-center">{item.status || '-'}</TableCell>
                    <TableCell>{formatDateTime(item.submittedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Modal>

      <Modal
        open={isReviewHistoryOpen}
        onOpenChange={setIsReviewHistoryOpen}
        title="History Review"
        description={
          activeItem
            ? `${activeItem.questionCode ?? '-'} - ${activeItem.questionText}`
            : 'Pilih CAP untuk melihat history review.'
        }
        className="w-[95vw] sm:max-w-[1200px]"
      >
        {reviewHistory.length === 0 ? (
          <div className="py-4 text-sm text-slate-500">
            Belum ada history review.
          </div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-44">Sumber</TableHead>
                  <TableHead className="w-48">Status</TableHead>
                  <TableHead>Remark</TableHead>
                  <TableHead className="w-40">Review By</TableHead>
                  <TableHead className="w-40">Review At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.source}</TableCell>
                    <TableCell>{item.status || '-'}</TableCell>
                    <TableCell>{item.remark || '-'}</TableCell>
                    <TableCell>{item.reviewedBy || '-'}</TableCell>
                    <TableCell>{formatDateTime(item.reviewedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
