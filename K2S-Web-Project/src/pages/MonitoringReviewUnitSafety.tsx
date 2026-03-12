import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Check,
  ChevronLeft,
  Circle,
  ClipboardCheck,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  SendHorizontal,
  UploadCloud,
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
import { Modal } from '@/components/shared/Modal';
import { toast } from '@/hooks/use-toast';
import { getAuthUser, resolveApiUrl } from '@/lib/api';
import {
  QUESTION_SECTION_LABELS,
  formatMonitoringDateTime as formatDateTime,
  isNotSatisfactoryStatus,
  resolveDetailScope,
  resolveQuestionRowClass,
  resolveQuestionSection,
  resolveTime,
  toDisplayValue as toDisplay,
  toReviewedBadgeLabel,
} from '@/lib/monitoringReview';
import {
  fetchSelfAssessmentCap,
  fetchSelfAssessmentAnswers,
  fetchSelfAssessmentEvidence,
  fetchSelfAssessmentReviewList,
  fetchSelfAssessmentSessions,
  submitSelfAssessmentAnswers,
  uploadSelfAssessmentEvidence,
  deleteSelfAssessmentEvidence,
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
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-900/50 sm:w-60';

type MonitoringListItem = {
  sessionAreaId: string;
  area: string;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  questionCount: number;
  submittedAt: string | null;
};

type MonitoringDetailItem = {
  answerId: string;
  questionCode: string;
  questionText: string;
  reference: string | null;
  status: string;
  review: {
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
  cap: {
    id: string;
    actionPlan: string;
    targetDate: string | null;
    status: string;
    sentAt: string | null;
    review: {
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
    monitoringReview?: {
      result: string | null;
      comment: string | null;
      status: string | null;
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
      files: Array<{ id: string; name: string; url: string }>;
    }>;
    extensions?: Array<{
      id: string;
      dueDate: string;
      fileName: string;
      fileUrl: string;
      status: string;
    }>;
  } | null;
};

type MonitoringSessionSelection = {
  sessionAreaId: string;
  area: string;
  scope: string;
  schedule: string | null;
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

type EditableAnswerState = {
  status: string;
  comment: string;
  evidence: string;
};

type EditableAnswerMeta = {
  isSubmitted: boolean;
  allowReply: boolean;
  isFinal: boolean;
};

const isWithinSessionWindow = (value: string | null, session: SelfAssessmentSession) => {
  if (!value) return true;
  const submittedAt = new Date(value).getTime();
  if (Number.isNaN(submittedAt)) return true;

  const start = session.startDate ? new Date(`${session.startDate}T00:00:00`).getTime() : NaN;
  const end = session.endDate ? new Date(`${session.endDate}T23:59:59`).getTime() : NaN;
  if (Number.isNaN(start) || Number.isNaN(end)) return true;

  return submittedAt >= start && submittedAt <= end;
};

export function MonitoringReviewUnitSafety() {
  const authUser = getAuthUser<{ name?: string }>();

  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<MonitoringListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [monitoringSessions, setMonitoringSessions] = useState<SelfAssessmentSession[]>([]);

  const [selectedSession, setSelectedSession] =
    useState<MonitoringSessionSelection | null>(null);
  const [detailItems, setDetailItems] = useState<MonitoringDetailItem[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [detailSearchText, setDetailSearchText] = useState('');
  const [isFulfillmentHistoryOpen, setIsFulfillmentHistoryOpen] = useState(false);
  const [isReviewHistoryOpen, setIsReviewHistoryOpen] = useState(false);
  const [editableAnswersByCode, setEditableAnswersByCode] = useState<
    Record<string, EditableAnswerState>
  >({});
  const [editableAnswerMetaByCode, setEditableAnswerMetaByCode] = useState<
    Record<string, EditableAnswerMeta>
  >({});
  const [selfAssessmentEvidenceFiles, setSelfAssessmentEvidenceFiles] = useState<
    Array<{ id: string; name: string; url: string }>
  >([]);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;

  const loadMonitoringSessions = () => {
    fetchSelfAssessmentSessions('monitoring')
      .then((sessions) => setMonitoringSessions(sessions ?? []))
      .catch(() => setMonitoringSessions([]));
  };

  const loadItems = () => {
    setIsLoadingList(true);
    fetchSelfAssessmentReviewList({
      scope: 'monitoring',
      month: month === 'ALL' ? undefined : month,
      year,
    })
      .then((data) => {
        setItems(data as MonitoringListItem[]);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoadingList(false));
  };

  useEffect(() => {
    loadMonitoringSessions();
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const resetFilters = () => {
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setSearchText('');
  };

  const filteredItems = useMemo(() => {
    if (monitoringSessions.length === 0) return [] as MonitoringListItem[];

    const selectedTargetIds = monitoringSessions.flatMap(
      (session) => session.targetSessionAreaIds ?? []
    );
    const hasOpenAllAreaSession = monitoringSessions.some(
      (session) => !(session.targetSessionAreaIds?.length)
    );

    const sourceItems = hasOpenAllAreaSession
      ? items.filter((item) =>
          monitoringSessions.some((session) => isWithinSessionWindow(item.submittedAt, session))
        )
      : selectedTargetIds.length > 0
      ? items.filter((item) => selectedTargetIds.includes(item.sessionAreaId))
      : [];

    const term = searchText.trim().toLowerCase();
    if (!term) return sourceItems;
    return sourceItems.filter((item) =>
      `${item.area} ${item.leader}`.toLowerCase().includes(term)
    );
  }, [items, monitoringSessions, searchText]);

  const openDetail = (item: MonitoringSessionSelection) => {
    setSelectedSession(item);
    setDetailSearchText('');
    setIsLoadingDetail(true);

    Promise.all([
      fetchSelfAssessmentCap({
        scope: resolveDetailScope(item.scope),
        sessionAreaId: item.sessionAreaId,
        includeReviewed: true,
      }),
      fetchSelfAssessmentAnswers(item.sessionAreaId).catch(() => []),
    ])
      .then(([capData, answerData]) => {
        const normalized = (capData as MonitoringDetailItem[]).filter(
          (capItem) => capItem.cap
        );
        setDetailItems(normalized);
        setActiveAnswerId(normalized[0]?.answerId ?? null);

        const nextAnswerState: Record<string, EditableAnswerState> = {};
        const nextAnswerMeta: Record<string, EditableAnswerMeta> = {};
        answerData.forEach((answer) => {
          nextAnswerState[answer.questionCode] = {
            status: answer.status ?? 'Satisfactory',
            comment: answer.comment ?? '',
            evidence: answer.evidenceNote ?? '',
          };
          nextAnswerMeta[answer.questionCode] = {
            isSubmitted: Boolean(answer.isSubmitted),
            allowReply: Boolean(answer.review?.allowReply),
            isFinal: Boolean(answer.review?.isFinal),
          };
        });
        setEditableAnswersByCode(nextAnswerState);
        setEditableAnswerMetaByCode(nextAnswerMeta);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat detail',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoadingDetail(false));
  };

  const filteredDetailItems = useMemo(() => {
    const term = detailSearchText.trim().toLowerCase();
    if (!term) return detailItems;
    return detailItems.filter((item) =>
      `${item.questionCode ?? ''} ${item.questionText}`
        .toLowerCase()
        .includes(term)
    );
  }, [detailItems, detailSearchText]);

  const groupedDetailItems = useMemo(() => {
    const grouped = new Map<string, MonitoringDetailItem[]>();
    filteredDetailItems.forEach((item) => {
      const section = resolveQuestionSection(item.questionCode);
      const currentGroup = grouped.get(section) ?? [];
      currentGroup.push(item);
      grouped.set(section, currentGroup);
    });
    return Array.from(grouped.entries());
  }, [filteredDetailItems]);

  const detailSummary = useMemo(() => {
    const total = filteredDetailItems.length;
    const closed = filteredDetailItems.reduce((count, item) => {
      const implementationStatus =
        item.cap?.monitoringReview?.status ??
        item.cap?.monitoringReview?.result ??
        item.review?.status;
      const isClosedItem =
        Boolean(item.cap?.monitoringReview?.reviewedAt) &&
        !isNotSatisfactoryStatus(implementationStatus);
      return isClosedItem ? count + 1 : count;
    }, 0);

    return {
      total,
      closed,
      open: Math.max(0, total - closed),
    };
  }, [filteredDetailItems]);

  useEffect(() => {
    if (!activeAnswerId && detailItems[0]) {
      setActiveAnswerId(detailItems[0].answerId);
      return;
    }
    if (
      activeAnswerId &&
      !detailItems.some((item) => item.answerId === activeAnswerId)
    ) {
      setActiveAnswerId(detailItems[0]?.answerId ?? null);
    }
  }, [activeAnswerId, detailItems]);

  const activeItem = useMemo(
    () => detailItems.find((item) => item.answerId === activeAnswerId) ?? null,
    [detailItems, activeAnswerId]
  );

  const latestFulfillment = useMemo(() => {
    const fulfillments = activeItem?.cap?.fulfillments ?? [];
    if (fulfillments.length === 0) {
      return null;
    }
    return [...fulfillments].sort((a, b) => {
      const timeA = Math.max(resolveTime(a.submittedAt), resolveTime(a.createdAt));
      const timeB = Math.max(resolveTime(b.submittedAt), resolveTime(b.createdAt));
      return timeB - timeA;
    })[0];
  }, [activeItem]);

  const latestExtension = useMemo(() => {
    const extensions = activeItem?.cap?.extensions ?? [];
    if (extensions.length === 0) {
      return null;
    }
    return [...extensions].sort(
      (a, b) => resolveTime(b.dueDate) - resolveTime(a.dueDate)
    )[0];
  }, [activeItem]);

  const fulfillmentHistory = useMemo(() => {
    const fulfillments = activeItem?.cap?.fulfillments ?? [];
    if (fulfillments.length === 0) return [] as FulfillmentHistoryItem[];
    return fulfillments
      .slice()
      .sort((a, b) => {
        const timeA = Math.max(resolveTime(a.submittedAt), resolveTime(a.createdAt));
        const timeB = Math.max(resolveTime(b.submittedAt), resolveTime(b.createdAt));
        if (timeA === timeB) return b.step - a.step;
        return timeB - timeA;
      })
      .map((item) => ({
        id: item.id,
        step: item.step,
        proposeAction: item.proposeAction,
        actionOffice: item.actionOffice,
        evidenceReference: item.evidenceReference,
        progress: item.progress,
        status: item.status,
        submittedAt: item.submittedAt ?? item.createdAt ?? null,
        fileCount: item.files.length,
      }));
  }, [activeItem]);

  const reviewHistory = useMemo(() => {
    if (!activeItem) return [] as ReviewHistoryItem[];
    const entries: ReviewHistoryItem[] = [];
    if (activeItem.review) {
      entries.push({
        id: `${activeItem.answerId}-self-assessment-review`,
        source: 'Review Unit Safety',
        status: activeItem.review.status ?? '-',
        remark:
          activeItem.review.description ??
          activeItem.review.resume ??
          activeItem.review.finding ??
          '-',
        reviewedBy: activeItem.review.reviewedBy?.name ?? '-',
        reviewedAt: activeItem.review.reviewedAt ?? null,
      });
    }
    if (activeItem.cap?.monitoringReview) {
      entries.push({
        id: `${activeItem.answerId}-monitoring-review`,
        source: 'Review Monitoring',
        status:
          activeItem.cap.monitoringReview.status ??
          activeItem.cap.monitoringReview.result ??
          '-',
        remark: activeItem.cap.monitoringReview.comment ?? '-',
        reviewedBy: activeItem.cap.monitoringReview.reviewedBy?.name ?? '-',
        reviewedAt: activeItem.cap.monitoringReview.reviewedAt ?? null,
      });
    }
    return entries.sort((a, b) => resolveTime(b.reviewedAt) - resolveTime(a.reviewedAt));
  }, [activeItem]);

  const activeImplementationStatus =
    activeItem?.cap?.monitoringReview?.status ??
    activeItem?.cap?.monitoringReview?.result ??
    activeItem?.review?.status;
  const activeIsNotSatisfactory = isNotSatisfactoryStatus(activeImplementationStatus);
  const activeFulfillmentProgress = Math.max(
    0,
    Math.min(100, latestFulfillment?.progress ?? 0)
  );
  const activeFulfillmentReviewed = Boolean(
    activeItem?.cap?.monitoringReview?.reviewedAt
  );
  const activeFulfillmentReviewStatus =
    activeItem?.cap?.monitoringReview?.status ??
    activeItem?.cap?.monitoringReview?.result ??
    'Not Satisfactory';
  const activeFulfillmentInfoText = activeFulfillmentReviewed
    ? `CAP sudah memiliki pemenuhan sebesar ${activeFulfillmentProgress}% dan sudah direview dengan status ${activeFulfillmentReviewStatus}.`
    : `CAP sudah memiliki pemenuhan sebesar ${activeFulfillmentProgress}%.`;

  const createdBy =
    activeItem?.cap?.monitoringReview?.reviewedBy?.name ??
    activeItem?.review?.reviewedBy?.name ??
    authUser?.name ??
    '-';

  const createdAt = formatDateTime(
    activeItem?.cap?.monitoringReview?.reviewedAt ??
    latestFulfillment?.createdAt ??
    latestFulfillment?.submittedAt
  );

  const lastModified = formatDateTime(
    latestFulfillment?.submittedAt ??
    latestFulfillment?.createdAt ??
    activeItem?.cap?.monitoringReview?.reviewedAt
  );

  const activeQuestionCode = activeItem?.questionCode ?? '';
  const activeEditableAnswer = activeQuestionCode
    ? (editableAnswersByCode[activeQuestionCode] ?? {
        status: activeItem?.status ?? 'Satisfactory',
        comment: '',
        evidence: '',
      })
    : {
        status: 'Satisfactory',
        comment: '',
        evidence: '',
      };
  const activeAnswerMeta = activeQuestionCode
    ? (editableAnswerMetaByCode[activeQuestionCode] ?? {
        isSubmitted: false,
        allowReply: false,
        isFinal: false,
      })
    : {
        isSubmitted: false,
        allowReply: false,
        isFinal: false,
      };
  const isEditableLocked = activeAnswerMeta.isFinal;
  const hasSelfAssessmentEvidence = selfAssessmentEvidenceFiles.length > 0;

  const updateActiveEditableAnswer = (
    next: Partial<EditableAnswerState>
  ) => {
    if (!activeQuestionCode) return;
    setEditableAnswersByCode((prev) => ({
      ...prev,
      [activeQuestionCode]: {
        status: next.status ?? prev[activeQuestionCode]?.status ?? activeItem?.status ?? 'Satisfactory',
        comment: next.comment ?? prev[activeQuestionCode]?.comment ?? '',
        evidence: next.evidence ?? prev[activeQuestionCode]?.evidence ?? '',
      },
    }));
  };

  const saveAnswer = async (submit: boolean) => {
    if (!selectedSession || !activeQuestionCode) return;
    if (isEditableLocked) {
      toast({
        title: 'Review sudah final',
        description: 'Jawaban tidak bisa diubah lagi.',
      });
      return;
    }
    if (!hasSelfAssessmentEvidence && submit) {
      toast({
        title: 'Evidence wajib diunggah',
        description: 'Upload minimal 1 file evidence sebelum kirim jawaban.',
      });
      return;
    }

    setIsSavingAnswer(true);
    try {
      await submitSelfAssessmentAnswers([
        {
          sessionAreaId: selectedSession.sessionAreaId,
          questionCode: activeQuestionCode,
          status: activeEditableAnswer.status || 'Satisfactory',
          comment: activeEditableAnswer.comment || '',
          evidenceNote: activeEditableAnswer.evidence || '',
          submit,
        },
      ]);
      setEditableAnswerMetaByCode((prev) => ({
        ...prev,
        [activeQuestionCode]: {
          isSubmitted: submit,
          allowReply: prev[activeQuestionCode]?.allowReply ?? false,
          isFinal: prev[activeQuestionCode]?.isFinal ?? false,
        },
      }));
      toast({
        title: submit ? 'Jawaban terkirim' : 'Draft tersimpan',
      });
    } catch (error) {
      toast({
        title: submit ? 'Gagal mengirim jawaban' : 'Gagal menyimpan draft',
        description:
          error instanceof Error && error.message ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSavingAnswer(false);
    }
  };

  useEffect(() => {
    if (!selectedSession || !activeQuestionCode) {
      setSelfAssessmentEvidenceFiles([]);
      setAnswerError(null);
      return;
    }
    fetchSelfAssessmentEvidence({
      sessionAreaId: selectedSession.sessionAreaId,
      questionCode: activeQuestionCode,
    })
      .then((files) => {
        setSelfAssessmentEvidenceFiles(files ?? []);
        setAnswerError(null);
      })
      .catch((error: Error) => {
        setSelfAssessmentEvidenceFiles([]);
        setAnswerError(error.message || 'Gagal memuat evidence.');
      });
  }, [selectedSession, activeQuestionCode]);

  const handleUploadEvidence = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!selectedSession || !activeQuestionCode || files.length === 0) {
      return;
    }
    if (isEditableLocked) {
      toast({
        title: 'Review sudah final',
        description: 'Evidence tidak bisa diubah.',
      });
      return;
    }

    setIsUploadingEvidence(true);
    setAnswerError(null);
    try {
      for (const file of files) {
        await uploadSelfAssessmentEvidence({
          sessionAreaId: selectedSession.sessionAreaId,
          questionCode: activeQuestionCode,
          file,
        });
      }
      const nextFiles = await fetchSelfAssessmentEvidence({
        sessionAreaId: selectedSession.sessionAreaId,
        questionCode: activeQuestionCode,
      });
      setSelfAssessmentEvidenceFiles(nextFiles ?? []);
    } catch (error) {
      setAnswerError(
        error instanceof Error && error.message ? error.message : 'Gagal upload evidence.'
      );
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    if (!selectedSession || !activeQuestionCode) return;
    if (isEditableLocked) {
      toast({
        title: 'Review sudah final',
        description: 'Evidence tidak bisa diubah.',
      });
      return;
    }

    try {
      await deleteSelfAssessmentEvidence(id);
      const nextFiles = await fetchSelfAssessmentEvidence({
        sessionAreaId: selectedSession.sessionAreaId,
        questionCode: activeQuestionCode,
      });
      setSelfAssessmentEvidenceFiles(nextFiles ?? []);
    } catch (error) {
      setAnswerError(
        error instanceof Error && error.message ? error.message : 'Gagal menghapus evidence.'
      );
    }
  };

  if (selectedSession) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Monitoring / Protocol Question (PQ)
              </p>
              <h1 className="text-lg font-semibold text-slate-800">
                Agenda Monitoring
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {selectedSession.area} • {selectedSession.schedule ?? '-'}
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setSelectedSession(null);
                setDetailItems([]);
                setActiveAnswerId(null);
              }}
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
                  value={detailSearchText}
                  onChange={(event) => setDetailSearchText(event.target.value)}
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
                  {selectedSession.area}
                </div>

                {isLoadingDetail ? (
                  <div className="px-3 py-4 text-sm text-slate-500">Memuat data...</div>
                ) : groupedDetailItems.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">
                    Belum ada data protocol question.
                  </div>
                ) : (
                  groupedDetailItems.map(([section, sectionItems], index) => (
                    <div
                      key={section}
                      className={index < groupedDetailItems.length - 1 ? 'border-b border-slate-200' : ''}
                    >
                      <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                        {section} - {QUESTION_SECTION_LABELS[section] ?? 'LAINNYA'}
                      </div>
                      <div className="divide-y divide-slate-200">
                        {sectionItems.map((item) => {
                          const implementationStatus =
                            item.cap?.monitoringReview?.status ??
                            item.cap?.monitoringReview?.result ??
                            item.review?.status;
                          const isClosedItem =
                            Boolean(item.cap?.monitoringReview?.reviewedAt) &&
                            !isNotSatisfactoryStatus(implementationStatus);
                          const isActive = activeAnswerId === item.answerId;
                          return (
                            <button
                              key={item.answerId}
                              type="button"
                              onClick={() => setActiveAnswerId(item.answerId)}
                              className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition-colors ${resolveQuestionRowClass(
                                isClosedItem,
                                isActive
                              )}`}
                            >
                              <span
                                className="mt-1 inline-flex h-4 w-4 items-center justify-center"
                              >
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
                                    {toReviewedBadgeLabel(
                                      item.cap?.monitoringReview?.reviewedAt
                                    )}
                                  </div>
                                )}
                              </div>
                              <SendHorizontal className="mt-1 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="text-slate-500">
                  {activeFulfillmentInfoText}
                </span>
                <span className="text-slate-500">Ket :</span>
                <span
                  className={`rounded-md px-2 py-1 ${
                    activeFulfillmentReviewed && !isNotSatisfactoryStatus(activeFulfillmentReviewStatus)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-[#991b1b]'
                  }`}
                >
                  {activeFulfillmentReviewed && !isNotSatisfactoryStatus(activeFulfillmentReviewStatus)
                    ? 'Satisfactory'
                    : 'Not Satisfactory'}
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
                      value={toDisplay(activeItem?.review?.finding)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Current Mitigation
                    </label>
                    <Textarea
                      rows={4}
                      readOnly
                      value={toDisplay(
                        latestFulfillment?.proposeAction ?? activeItem?.cap?.actionPlan
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Remark</label>
                    <Textarea
                      rows={3}
                      readOnly
                      value={toDisplay(
                        latestFulfillment?.actionOffice ?? activeItem?.cap?.monitoringReview?.comment
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Due Date</label>
                    <Input
                      readOnly
                      value={toDisplay(
                        latestFulfillment?.completeDate ?? activeItem?.cap?.targetDate
                      )}
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
                          value={activeEditableAnswer.comment}
                          onChange={(event) =>
                            updateActiveEditableAnswer({ comment: event.target.value })
                          }
                          disabled={isEditableLocked || isSavingAnswer}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Referensi Regulasi
                        </label>
                        <Textarea rows={3} readOnly value={toDisplay(activeItem?.reference)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Evidence</label>
                        <Textarea
                          rows={3}
                          value={activeEditableAnswer.evidence}
                          onChange={(event) =>
                            updateActiveEditableAnswer({ evidence: event.target.value })
                          }
                          disabled={isEditableLocked || isSavingAnswer}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">
                        Status Of Implementation
                      </label>
                      <select
                        className={`h-10 w-full rounded-md border border-slate-200 px-3 text-sm ${
                          activeIsNotSatisfactory ? 'border-red-200 bg-red-50 text-red-600 font-semibold' : ''
                        }`}
                        value={activeEditableAnswer.status || 'Satisfactory'}
                        onChange={(event) =>
                          updateActiveEditableAnswer({ status: event.target.value })
                        }
                        disabled={isEditableLocked || isSavingAnswer}
                      >
                        <option value="Satisfactory">Satisfactory</option>
                        <option value="Not Satisfactory">Not Satisfactory</option>
                        <option value="Not Aplicable">Not Aplicable</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Created By</label>
                      <Input readOnly value={createdBy} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Created At</label>
                      <Input readOnly value={createdAt} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Edited By</label>
                      <Input readOnly value={createdBy} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Last Modified</label>
                      <Input readOnly value={lastModified} />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-700">File evidence</div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      <UploadCloud className="h-3.5 w-3.5" />
                      Upload
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleUploadEvidence}
                        disabled={isEditableLocked || isUploadingEvidence || isSavingAnswer}
                      />
                    </label>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-16 text-center text-xs">NO</TableHead>
                          <TableHead className="text-xs">FILENAME</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selfAssessmentEvidenceFiles.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-xs text-slate-500">
                              Tidak ada file evidence.
                            </TableCell>
                          </TableRow>
                        ) : (
                          selfAssessmentEvidenceFiles.map((file, index) => (
                            <TableRow key={file.id}>
                              <TableCell className="text-center text-xs">{index + 1}</TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <a
                                    href={resolveApiUrl(file.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-blue-600 hover:underline"
                                  >
                                    {file.name}
                                  </a>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[11px] text-red-600"
                                    onClick={() => handleDeleteEvidence(file.id)}
                                    disabled={isEditableLocked || isSavingAnswer}
                                  >
                                    Hapus
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {isUploadingEvidence && (
                    <div className="mt-2 text-xs text-slate-500">Mengunggah evidence...</div>
                  )}
                  {answerError && (
                    <div className="mt-2 text-xs text-red-500">{answerError}</div>
                  )}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => saveAnswer(false)}
                      disabled={isEditableLocked || isSavingAnswer}
                    >
                      Simpan Draft
                    </Button>
                    <Button
                      type="button"
                      className="bg-blue-500 text-white hover:bg-blue-600"
                      onClick={() => saveAnswer(true)}
                      disabled={isEditableLocked || isSavingAnswer || !hasSelfAssessmentEvidence}
                    >
                      Kirim
                    </Button>
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
                      <Input
                        readOnly
                        className={
                          activeIsNotSatisfactory
                            ? 'border-red-200 bg-red-50 text-red-600 font-semibold'
                            : undefined
                        }
                        value={toDisplay(activeItem?.cap?.monitoringReview?.status)}
                      />
                    </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs font-medium text-slate-600">Remark</label>
                    <Textarea
                      rows={3}
                      readOnly
                      value={toDisplay(activeItem?.cap?.monitoringReview?.comment)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Review By</label>
                      <Input
                        readOnly
                        value={toDisplay(activeItem?.cap?.monitoringReview?.reviewedBy?.name)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Review At</label>
                      <Input
                        readOnly
                        value={formatDateTime(activeItem?.cap?.monitoringReview?.reviewedAt)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-slate-700">Perpanjangan CAP</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Due Date</label>
                    <Input readOnly value={toDisplay(latestExtension?.dueDate)} />
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
                          <div>{toDisplay(item.proposeAction)}</div>
                          <div className="text-xs text-slate-500">
                            Evidence: {toDisplay(item.evidenceReference)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{toDisplay(item.actionOffice)}</TableCell>
                      <TableCell className="text-center">{item.progress}%</TableCell>
                      <TableCell className="text-center">{item.fileCount}</TableCell>
                      <TableCell className="text-center">{toDisplay(item.status)}</TableCell>
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
                      <TableCell>{toDisplay(item.status)}</TableCell>
                      <TableCell>{toDisplay(item.remark)}</TableCell>
                      <TableCell>{toDisplay(item.reviewedBy)}</TableCell>
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
              <span>Monitoring</span>
              <span>/</span>
              <span className="font-semibold text-blue-600">Protocol Question (PQ)</span>
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
                    Data Agenda Monitoring
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Lihat dan kelola data agenda monitoring Protocol Question (PQ).
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
              <div className="relative min-w-[220px] flex-1">
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
                onClick={() => {
                  loadMonitoringSessions();
                  loadItems();
                }}
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
                        Audity
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingList ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
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
                                {monitoringSessions.length === 0
                                  ? 'Sesi monitoring belum dibuka admin.'
                                  : 'Coba ubah filter bulan/tahun atau reset filter'}
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
                                  scope: item.scope,
                                  schedule: item.schedule,
                                })
                              }
                            >
                              {item.area}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center text-sm">{item.leader}</TableCell>
                          <TableCell className="text-sm">
                            <ol className="list-decimal space-y-1 pl-4">
                              {item.dnp.map((name, memberIndex) => (
                                <li key={`${item.sessionAreaId}-dnp-${memberIndex}`}>{name}</li>
                              ))}
                            </ol>
                          </TableCell>
                          <TableCell className="text-sm">
                            <ol className="list-decimal space-y-1 pl-4">
                              {item.kobo.map((name, memberIndex) => (
                                <li key={`${item.sessionAreaId}-kobo-${memberIndex}`}>{name}</li>
                              ))}
                            </ol>
                          </TableCell>
                          <TableCell className="text-center text-sm text-slate-500 dark:text-slate-300">
                            {item.schedule ?? 'Menunggu admin'}
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
