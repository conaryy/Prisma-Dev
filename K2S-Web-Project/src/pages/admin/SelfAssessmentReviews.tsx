import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ClipboardCheck,
  FileText,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  SelfAssessmentAssessmentEditorPanel,
} from '@/components/self-assessment/SelfAssessmentAssessmentEditorPanel';
import {
  SelfAssessmentDnpAnswerPairingPanel,
} from '@/components/self-assessment/SelfAssessmentDnpAnswerPairingPanel';
import {
  SelfAssessmentDnpLoginPanel,
} from '@/components/self-assessment/SelfAssessmentDnpLoginPanel';
import {
  SelfAssessmentDnpSnapshotPanel,
} from '@/components/self-assessment/SelfAssessmentDnpSnapshotPanel';
import {
  SelfAssessmentResultSubmissionPanel,
} from '@/components/self-assessment/SelfAssessmentResultSubmissionPanel';
import {
  SelfAssessmentReviewDetailPanel,
} from '@/components/self-assessment/SelfAssessmentReviewDetailPanel';
import {
  SelfAssessmentSubmissionTable,
  type SelfAssessmentSubmissionTableRow,
} from '@/components/self-assessment/SelfAssessmentSubmissionTable';
import {
  SelfAssessmentListFilters,
  SelfAssessmentWorkspace,
} from '@/components/self-assessment/SelfAssessmentWorkspace';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAsyncJobPolling } from '@/hooks/useAsyncJobPolling';
import {
  restoreSelectedDnpMatches,
  useDnpMatchSelection,
} from '@/hooks/useDnpMatchSelection';
import { useDnpSessionAreaFlow } from '@/hooks/useDnpSessionAreaFlow';
import { resolveApiUrl } from '@/lib/api';
import {
  SELF_ASSESSMENT_MONTH_OPTIONS as MONTH_OPTIONS,
  SELF_ASSESSMENT_YEAR_OPTIONS as YEAR_OPTIONS,
} from '@/lib/selfAssessmentFilters';
import {
  deleteAdminSelfAssessmentEvidence,
  deleteSelfAssessmentResultFile,
  fetchAdminSelfAssessmentExportDnpImportJob,
  fetchAdminSelfAssessmentImportDnpInjectJob,
  fetchAdminSelfAssessmentSubmissionDetail,
  fetchAdminSelfAssessmentSubmissions,
  exportAdminSelfAssessmentToDnp,
  finalizeSelfAssessmentResult,
  importAdminSelfAssessmentExportDnp,
  injectAdminSelfAssessmentFromDnp,
  saveAdminSelfAssessmentExportDnpMatches,
  submitAdminSelfAssessmentAnswers,
  submitAdminSelfAssessmentReviews,
  uploadAdminSelfAssessmentEvidence,
  type SelfAssessmentExportDnpCompareSnapshot,
  type SelfAssessmentExportDnpImportJobResponse,
  type SelfAssessmentImportDnpInjectJobStatus,
} from '@/lib/selfAssessment';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'audit', label: 'Audit' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'inspeksi', label: 'Inspeksi' },
  { value: 'surveillance', label: 'Surveillance' },
];
const QUESTION_ITEMS_PER_PAGE = 5;
const DEFAULT_DNP_MATCH_THRESHOLD = 70;

const normalizeAssessmentStatus = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (normalized === 'Not Aplicable') {
    return 'Not Applicable';
  }
  if (normalized === 'Not Applicable') {
    return 'Not Applicable';
  }
  if (normalized === 'Not Satisfactory') {
    return 'Not Satisfactory';
  }
  return 'Satisfactory';
};

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
  showResultSubmissionSection?: boolean;
  detailPanelMode?: 'review' | 'assessment' | 'importDnp';
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
  dnpCompare?: SelfAssessmentExportDnpCompareSnapshot | null;
  dnpSession?: {
    active: boolean;
    sessionId: string | null;
    scope?: string | null;
    sessionAreaId?: string | null;
    fillArea?: string | null;
    fillCode1?: string | null;
    fillCode2?: string | null;
    year?: number | null;
  } | null;
  dnpImportJob?: {
    jobId: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    message?: string | null;
    createdAt?: string | null;
    startedAt?: string | null;
  } | null;
  dnpInjectJob?: {
    jobId: string;
    status: SelfAssessmentImportDnpInjectJobStatus;
    message?: string | null;
    createdAt?: string | null;
    startedAt?: string | null;
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
    evidenceNote?: string | null;
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
  showResultSubmissionSection = true,
  detailPanelMode = 'review',
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
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionSummary | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [questionPage, setQuestionPage] = useState(1);
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
  const [assessmentInputs, setAssessmentInputs] = useState<
    Record<
      string,
      {
        status: string;
        comment: string;
        evidenceNote: string;
      }
    >
  >({});
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<'finalize' | 'allow'>('allow');
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
  const [dnpQuestionPage, setDnpQuestionPage] = useState(1);
  const {
    sessionId: dnpSessionId,
    setSessionId: setDnpSessionId,
    captchaUrl: dnpCaptchaUrl,
    setCaptchaUrl: setDnpCaptchaUrl,
    username: dnpUsername,
    setUsername: setDnpUsername,
    password: dnpPassword,
    setPassword: setDnpPassword,
    captcha: dnpCaptcha,
    setCaptcha: setDnpCaptcha,
    year: dnpYear,
    setYear: setDnpYear,
    areas: dnpAreas,
    setAreas: setDnpAreas,
    selectedAreaKey: selectedDnpAreaKey,
    setSelectedAreaKey: setSelectedDnpAreaKey,
    selectedArea: selectedDnpArea,
    initializeSession: initializeDnpSession,
    loadAreas: loadDnpAreas,
  } = useDnpSessionAreaFlow({ initialYear: '' });
  const [dnpImportError, setDnpImportError] = useState<string | null>(null);
  const [dnpImportMessage, setDnpImportMessage] = useState<string | null>(null);
  const [dnpImportDetail, setDnpImportDetail] = useState<string | null>(null);
  const [isImportingDnp, setIsImportingDnp] = useState(false);
  const [isDnpLoginCollapsed, setIsDnpLoginCollapsed] = useState(false);
  const [dnpMatchThreshold, setDnpMatchThreshold] = useState(
    DEFAULT_DNP_MATCH_THRESHOLD
  );
  const [isExportingToDnp, setIsExportingToDnp] = useState(false);
  const [isInjectingFromDnp, setIsInjectingFromDnp] = useState(false);
  const [includeDnpEvidenceOnInject, setIncludeDnpEvidenceOnInject] = useState(false);
  const [skipDuplicateDnpFileNames, setSkipDuplicateDnpFileNames] = useState(true);
  const [dnpExportResult, setDnpExportResult] = useState<{
    summary: {
      total: number;
      success: number;
      failed: number;
      skipped: number;
    };
    results: Array<{
      answerId: string;
      localQuestionCode: string;
      dnpQuestionCode: string;
      status: 'success' | 'failed' | 'skipped';
      message: string;
      uploads?: Array<{
        evidenceId: string;
        fileName: string;
        status: 'success' | 'failed' | 'skipped';
        message: string;
      }>;
    }>;
  } | null>(null);
  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;
  const userFilterOptions = useMemo(() => {
    const uniqueUsers = new Map<string, { id: string; name: string }>();

    submissions.forEach((item) => {
      if (!item.user?.id) return;
      uniqueUsers.set(item.user.id, {
        id: item.user.id,
        name: item.user.name?.trim() || item.user.email?.trim() || item.user.id,
      });
    });

    return [
      { value: 'all', label: 'Semua User' },
      ...[...uniqueUsers.values()]
        .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
        .map((user) => ({
          value: user.id,
          label: user.name,
        })),
    ];
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const source = submissions.filter((item) => {
      if (selectedUserId !== 'all' && item.user?.id !== selectedUserId) {
        return false;
      }

      if (!term) {
        return true;
      }

      return `${item.area} ${item.leader} ${item.user?.name ?? ''}`
        .toLowerCase()
        .includes(term);
    });

    return [...source].sort((a, b) => {
      const scheduleDiff =
        parseScheduleReleaseTime(b.schedule) - parseScheduleReleaseTime(a.schedule);
      if (scheduleDiff !== 0) return scheduleDiff;
      const submittedA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const submittedB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return submittedB - submittedA;
    });
  }, [selectedUserId, submissions, searchText]);
  const submissionRows: SelfAssessmentSubmissionTableRow[] = filteredSubmissions.map(
    (item, index) => ({
      id: `${item.sessionAreaId}-${item.user?.id ?? index}`,
      scope: item.scope,
      areas: [{ id: item.sessionAreaId, label: item.area, onClick: () => handleSelect(item) }],
      userName: item.user?.name ?? '-',
      leader: item.leader,
      members: item.dnp,
      auditees: item.kobo,
      schedule: formatScheduleDisplay(item.schedule, '-'),
      action: {
        label: reviewLabel,
        onClick: () => handleSelect(item),
      },
    })
  );

  const loadSubmissions = () => {
    setIsLoading(true);
    fetchAdminSelfAssessmentSubmissions({
      scope: scope === 'all' ? undefined : (scope as SelfAssessmentScope),
      month: month === 'ALL' ? undefined : month,
      year,
      mode: detailPanelMode === 'importDnp' ? 'importDnp' : 'default',
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

  const { startPolling: startDnpImportPolling, stopPolling: stopDnpImportPolling } =
    useAsyncJobPolling<SelfAssessmentExportDnpImportJobResponse>({
      poll: fetchAdminSelfAssessmentExportDnpImportJob,
      isPending: (response) => {
        if (response.status === 'queued' || response.status === 'running') {
          setDnpImportMessage(
            response.message || 'Pengambilan data export DNP masih berjalan.'
          );
          return true;
        }
        return false;
      },
      onSuccess: (response) => {
        setIsImportingDnp(false);

        const snapshot = response.summary?.snapshot ?? null;
        if (snapshot) {
          setDetail((prev) =>
            prev
              ? {
                  ...prev,
                  dnpCompare: snapshot,
                }
              : prev
          );
          setDnpQuestionPage(1);
          setIsDnpLoginCollapsed(true);
        }
        setDnpImportMessage(
          response.message || 'Pengambilan data export DNP selesai.'
        );
        toast({
          title: 'Data DNP berhasil diambil',
          description: 'Snapshot pembanding DNP sudah tersimpan.',
        });
      },
      onFailure: (response) => {
        setIsImportingDnp(false);
        setIsDnpLoginCollapsed(false);
        setDnpImportError(
          response.error || response.message || 'Gagal mengambil data export DNP.'
        );
        const detailParts: string[] = [];
        if (response.detail) {
          detailParts.push(
            typeof response.detail === 'string'
              ? response.detail
              : JSON.stringify(response.detail, null, 2)
          );
        }
        if (response.debugLog && response.debugLog.length > 0) {
          detailParts.push(`Debug log:\n${response.debugLog.join('\n')}`);
        }
        setDnpImportDetail(detailParts.length > 0 ? detailParts.join('\n\n') : null);
      },
      onError: (error) => {
        setIsImportingDnp(false);
        setDnpImportError(error.message || 'Gagal mengambil data compare DNP.');
      },
    });

  const { startPolling: startDnpInjectPolling, stopPolling: stopDnpInjectPolling } =
    useAsyncJobPolling<Awaited<ReturnType<typeof fetchAdminSelfAssessmentImportDnpInjectJob>>>({
      poll: fetchAdminSelfAssessmentImportDnpInjectJob,
      isPending: (response) =>
        response.status === 'queued' || response.status === 'running',
      onSuccess: (response) => {
        setIsInjectingFromDnp(false);
        toast({
          title: 'Import jawaban berhasil',
          description:
            response.summary?.message ||
            response.message ||
            'Inject jawaban DNP selesai diproses.',
        });

        if (selectedSubmission) {
          loadDetail(selectedSubmission, { preferredAnswerId: activeAnswer?.id });
        }
      },
      onFailure: (response) => {
        setIsInjectingFromDnp(false);
        toast({
          title: 'Gagal import jawaban DNP',
          description:
            response.error ||
            response.message ||
            'Terjadi kesalahan saat inject jawaban DNP.',
        });
      },
      onError: (error) => {
        setIsInjectingFromDnp(false);
        toast({
          title: 'Gagal import jawaban DNP',
          description: error.message || 'Terjadi kesalahan saat inject jawaban DNP.',
        });
      },
    });

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

  const loadDetail = (
    submission: SubmissionSummary,
    options?: { preferredAnswerId?: string | null }
  ) => {
    if (!submission.user) {
      return;
    }
    setIsLoading(true);
    fetchAdminSelfAssessmentSubmissionDetail({
      sessionAreaId: submission.sessionAreaId,
      userId: submission.user.id,
      mode: detailPanelMode === 'importDnp' ? 'importDnp' : 'default',
    })
      .then((data) => {
        const preferredAnswerId = options?.preferredAnswerId ?? null;
        const preferredAnswerIndex =
          preferredAnswerId !== null
            ? data.answers.findIndex((answer) => answer.id === preferredAnswerId)
            : -1;
        const resolvedActiveAnswer =
          preferredAnswerIndex >= 0
            ? data.answers[preferredAnswerIndex]
            : data.answers[0] ?? null;

        setDetail(data);
        setActiveAnswerId(resolvedActiveAnswer?.id ?? null);
        setQuestionPage(
          preferredAnswerIndex >= 0
            ? Math.floor(preferredAnswerIndex / QUESTION_ITEMS_PER_PAGE) + 1
            : 1
        );
        setFinalizeStatus(
          data.result?.status === 'final' ? 'final' : 'interim'
        );
        setFinalizeFiles([]);
        setEvidenceError(null);
        setDnpQuestionPage(1);
        setDnpImportError(null);
        setDnpImportMessage(null);
        setDnpImportDetail(null);
        setDnpExportResult(null);
        setIsDnpLoginCollapsed(
          !!data.dnpCompare || !!data.dnpSession?.active || !!data.dnpImportJob
        );
        setDnpSessionId(data.dnpSession?.sessionId ?? '');
        setDnpCaptchaUrl('');
        setDnpCaptcha('');
        setDnpAreas(
          data.dnpSession?.fillCode1 && data.dnpSession?.fillCode2
            ? [
                {
                  fillCode1: data.dnpSession.fillCode1,
                  fillCode2: data.dnpSession.fillCode2,
                  area: data.dnpSession.fillArea ?? '',
                },
              ]
            : []
        );
        setSelectedDnpAreaKey(
          data.dnpSession?.fillCode1 && data.dnpSession?.fillCode2
            ? `${data.dnpSession.fillCode1}::${data.dnpSession.fillCode2}`
            : ''
        );
        setDnpYear(
          String(data.dnpSession?.year ?? data.dnpCompare?.year ?? derivedDnpYear)
        );
        syncSelectedMatches(restoreSelectedDnpMatches(data.dnpCompare));
        if (data.dnpImportJob?.jobId && ['queued', 'running'].includes(data.dnpImportJob.status)) {
          setIsImportingDnp(true);
          setDnpImportMessage(
            data.dnpImportJob.message || 'Pengambilan data export DNP masih berjalan.'
          );
          stopDnpImportPolling();
          void startDnpImportPolling(data.dnpImportJob.jobId);
        } else {
          setIsImportingDnp(false);
        }
        if (data.dnpInjectJob?.jobId && ['queued', 'running'].includes(data.dnpInjectJob.status)) {
          setIsInjectingFromDnp(true);
          stopDnpInjectPolling();
          void startDnpInjectPolling(data.dnpInjectJob.jobId);
        } else {
          setIsInjectingFromDnp(false);
        }
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
        const nextAssessmentInputs: Record<
          string,
          {
            status: string;
            comment: string;
            evidenceNote: string;
          }
        > = {};
        data.answers.forEach((answer) => {
          nextAssessmentInputs[answer.id] = {
            status: normalizeAssessmentStatus(answer.status),
            comment: answer.comment ?? '',
            evidenceNote: answer.evidenceNote ?? '',
          };
        });
        setReviewInputs(nextInputs);
        setAssessmentInputs(nextAssessmentInputs);
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

  const handleRefreshDnpState = () => {
    if (!selectedSubmission) {
      return;
    }
    loadDetail(selectedSubmission, { preferredAnswerId: activeAnswerId });
  };

  const activeAnswer = detail?.answers.find((answer) => answer.id === activeAnswerId);
  const activeDnpCompare = detail?.dnpCompare ?? null;
  const isAssessmentMode = detailPanelMode === 'assessment';
  const isImportDnpMode = detailPanelMode === 'importDnp';
  const {
    selectedDnpMatches,
    collapsedDnpMatches,
    dnpMatchesByAnswerId,
    matchedAnswerCount,
    totalSelectedEvidenceCount,
    syncSelectedMatches,
    autoPairDnpMatches,
    chooseDnpMatch,
    toggleDnpMatchCollapse,
    clearDnpMatch,
    clearAllDnpMatches,
  } = useDnpMatchSelection({
    answers: detail?.answers ?? [],
    compareSnapshot: activeDnpCompare,
    threshold: dnpMatchThreshold,
    isImportMode: isImportDnpMode,
    persistMatches: async (nextMatches, options) => {
      if (!selectedSubmission?.user || !detail) {
        return;
      }

      const response = await saveAdminSelfAssessmentExportDnpMatches({
        sessionAreaId: selectedSubmission.sessionAreaId,
        userId: selectedSubmission.user.id,
        matches: Object.values(nextMatches).map((match) => ({
          answerId: match.answerId,
          localQuestionCode: match.localQuestionCode,
          localQuestionText: match.localQuestionText,
          dnpSnapshotItemId: match.id,
          dnpQuestionCode: match.questionCode,
          dnpQuestionText: match.questionText,
          dnpReference: match.reference ?? '',
          similarity: match.similarity,
        })),
      });

      setDetail((prev) =>
        prev
          ? {
              ...prev,
              dnpCompare: prev.dnpCompare
                ? {
                    ...prev.dnpCompare,
                    selectedMatches: response.selectedMatches,
                  }
                : prev.dnpCompare,
            }
          : prev
      );

      if (!options?.silent) {
        toast({
          title: isImportDnpMode ? 'Mapping import tersimpan' : 'Mapping export tersimpan',
          description: isImportDnpMode
            ? 'Pilihan sumber pertanyaan DNP berhasil disimpan.'
            : 'Pilihan target pertanyaan DNP berhasil disimpan.',
        });
      }
    },
  });
  const activeAnswerMatches = activeAnswer
    ? dnpMatchesByAnswerId[activeAnswer.id] ?? []
    : [];
  const activeBestMatch = activeAnswerMatches[0] ?? null;
  const activeSelectedDnpMatch = activeAnswer
    ? selectedDnpMatches[activeAnswer.id] ?? null
    : null;
  const isActiveDnpMatchCollapsed = activeAnswer
    ? collapsedDnpMatches[activeAnswer.id] === true
    : false;
  const activeAnswerEvidenceCount = activeAnswer?.evidence.length ?? 0;
  const activeAssessmentInput = activeAnswer
    ? assessmentInputs[activeAnswer.id] ?? {
        status: normalizeAssessmentStatus(activeAnswer.status),
        comment: activeAnswer.comment ?? '',
        evidenceNote: activeAnswer.evidenceNote ?? '',
      }
    : null;
  const isAssessmentLocked = Boolean(detail?.result?.finalizedAt) || (activeAnswer?.review?.isFinal ?? false);
  const canOverrideAssessmentLock = detailPanelMode === 'assessment';
  const isAssessmentInputDisabled = isAssessmentLocked && !canOverrideAssessmentLock;
  const derivedDnpYear = useMemo(() => {
    const schedule = detail?.schedule ?? selectedSubmission?.schedule ?? null;
    if (!schedule) {
      return Number(year);
    }
    const matched = schedule.match(/\d{4}/);
    return matched ? Number(matched[0]) : Number(year);
  }, [detail?.schedule, selectedSubmission?.schedule, year]);

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

  const handleAssessmentChange = (
    answerId: string,
    value: Partial<{
      status: string;
      comment: string;
      evidenceNote: string;
    }>
  ) => {
    setAssessmentInputs((prev) => ({
      ...prev,
      [answerId]: {
        status: normalizeAssessmentStatus(value.status ?? prev[answerId]?.status),
        comment: value.comment ?? prev[answerId]?.comment ?? '',
        evidenceNote: value.evidenceNote ?? prev[answerId]?.evidenceNote ?? '',
      },
    }));
  };

  const runExportToDnp = async (answerIds?: string[]) => {
    if (!selectedSubmission?.user) {
      return;
    }
    if (!dnpSessionId) {
      setDnpImportError('Sesi DNP belum tersedia. Muat atau refresh sesi DNP terlebih dahulu.');
      return;
    }

    setIsExportingToDnp(true);
    setDnpImportError(null);
    try {
      const response = await exportAdminSelfAssessmentToDnp({
        sessionAreaId: selectedSubmission.sessionAreaId,
        userId: selectedSubmission.user.id,
        sessionId: dnpSessionId,
        answerIds,
        skipDuplicateFileNames: skipDuplicateDnpFileNames,
      });
      setDnpExportResult(response);
      toast({
        title: 'Export draft selesai',
        description: `${response.summary.success} berhasil, ${response.summary.failed} gagal, ${response.summary.skipped} dilewati.`,
      });
    } catch (error) {
      toast({
        title: 'Gagal export ke DNP',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    } finally {
      setIsExportingToDnp(false);
    }
  };

  const runInjectFromDnp = async (answerIds?: string[]) => {
    if (!selectedSubmission?.user) {
      return;
    }

    const activeMatchEntries = Object.values(selectedDnpMatches).filter((match) =>
      answerIds ? answerIds.includes(match.answerId) : true
    );

    if (activeMatchEntries.length === 0) {
      toast({
        title: 'Belum ada pairing import',
        description: 'Pilih pasangan pertanyaan lokal dan DNP terlebih dahulu.',
      });
      return;
    }

    setIsInjectingFromDnp(true);
    setDnpImportError(null);
    try {
      const response = await injectAdminSelfAssessmentFromDnp({
        sessionAreaId: selectedSubmission.sessionAreaId,
        userId: selectedSubmission.user.id,
        includeEvidence: includeDnpEvidenceOnInject,
        matches: activeMatchEntries.map((match) => ({
          answerId: match.answerId,
          dnpSnapshotItemId: match.id,
        })),
      });
      if (!response.jobId) {
        throw new Error('Job inject DNP tidak tersedia.');
      }
      toast({
        title: 'Inject jawaban dimulai',
        description:
          response.message || 'Inject jawaban DNP sedang diproses di background.',
      });
      stopDnpInjectPolling();
      await startDnpInjectPolling(response.jobId);
    } catch (error) {
      stopDnpInjectPolling();
      setIsInjectingFromDnp(false);
      toast({
        title: 'Gagal import jawaban DNP',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    }
  };

  const handleAssessmentSave = async () => {
    if (!activeAnswer) {
      return;
    }

    setIsSaving(true);
    try {
      await submitAdminSelfAssessmentAnswers({
        items: [
          {
            answerId: activeAnswer.id,
            status: activeAssessmentInput?.status ?? 'Satisfactory',
            comment: activeAssessmentInput?.comment ?? '',
            evidenceNote: activeAssessmentInput?.evidenceNote ?? '',
          },
        ],
        overrideFinalLock: canOverrideAssessmentLock,
      });

      toast({
        title: 'Perubahan tersimpan',
        description: 'Data self assessment berhasil diperbarui.',
      });

      if (selectedSubmission) {
        loadDetail(selectedSubmission, { preferredAnswerId: activeAnswer?.id });
      }
    } catch (error) {
      toast({
        title: 'Gagal menyimpan perubahan',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminEvidenceUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!activeAnswer || files.length === 0) {
      return;
    }

    setEvidenceError(null);
    setIsUploadingEvidence(true);
    try {
      for (const file of files) {
        await uploadAdminSelfAssessmentEvidence({
          answerId: activeAnswer.id,
          file,
          overrideFinalLock: canOverrideAssessmentLock,
        });
      }

      if (selectedSubmission) {
        loadDetail(selectedSubmission, { preferredAnswerId: activeAnswer?.id });
      }
    } catch (error) {
      setEvidenceError(
        error instanceof Error && error.message
          ? error.message
          : 'Gagal upload evidence.'
      );
    } finally {
      setIsUploadingEvidence(false);
      event.target.value = '';
    }
  };

  const handleAdminEvidenceDelete = async (evidenceId: string) => {
    if (!selectedSubmission) {
      return;
    }

    setEvidenceError(null);
    try {
      await deleteAdminSelfAssessmentEvidence(evidenceId, {
        overrideFinalLock: canOverrideAssessmentLock,
      });
      loadDetail(selectedSubmission, { preferredAnswerId: activeAnswer?.id });
    } catch (error) {
      setEvidenceError(
        error instanceof Error && error.message
          ? error.message
          : 'Gagal menghapus evidence.'
      );
    }
  };

  const handleInitDnpSession = async () => {
    setDnpImportError(null);
    setDnpImportMessage(null);
    setDnpImportDetail(null);
    setIsDnpLoginCollapsed(false);
    setDnpAreas([]);
    setSelectedDnpAreaKey('');
    setIsImportingDnp(true);
    try {
      await initializeDnpSession();
      toast({
        title: 'Sesi DNP siap',
        description: 'Captcha DNP berhasil dimuat.',
      });
    } catch (error) {
      setDnpImportError(
        error instanceof Error && error.message ? error.message : 'Gagal memuat sesi DNP.'
      );
    } finally {
      setIsImportingDnp(false);
    }
  };

  const handleLoadDnpAreas = async () => {
    if (!selectedSubmission || !detail) {
      return;
    }
    if (!dnpSessionId) {
      setDnpImportError('Buat sesi DNP terlebih dahulu.');
      return;
    }

    setDnpImportError(null);
    setDnpImportMessage(null);
    setDnpImportDetail(null);
    setIsDnpLoginCollapsed(false);
    setIsImportingDnp(true);
    try {
      await loadDnpAreas({
        sessionAreaId: selectedSubmission.sessionAreaId,
      });
      toast({
        title: 'Area DNP berhasil dimuat',
        description: 'Pilih area DNP untuk mengambil data export.',
      });
    } catch (error) {
      setDnpImportError(
        error instanceof Error && error.message
          ? error.message
          : 'Gagal mengambil daftar area DNP.'
      );
    } finally {
      setIsImportingDnp(false);
    }
  };

  const handleImportDnpCompare = async () => {
    if (!selectedSubmission?.user || !detail) {
      return;
    }
    if (!dnpSessionId) {
      setDnpImportError('Buat sesi DNP terlebih dahulu.');
      return;
    }
    if (!selectedDnpArea) {
      setDnpImportError('Pilih area DNP terlebih dahulu.');
      return;
    }

    setDnpImportError(null);
    setDnpImportMessage(null);
    setDnpImportDetail(null);
    setIsImportingDnp(true);
    stopDnpImportPolling();
    try {
      const yearNumber = Number(dnpYear || derivedDnpYear);
      const response = await importAdminSelfAssessmentExportDnp({
        sessionAreaId: selectedSubmission.sessionAreaId,
        userId: selectedSubmission.user.id,
        sessionId: dnpSessionId,
        username: dnpUsername,
        password: dnpPassword,
        captcha: dnpCaptcha,
        year: yearNumber,
        fillCode1: selectedDnpArea.fillCode1,
        fillCode2: selectedDnpArea.fillCode2,
        fillArea: selectedDnpArea.area,
      });
      if (!response.jobId) {
        throw new Error('Job import DNP tidak tersedia.');
      }
      setDnpImportMessage(
        response.message || 'Pengambilan data export DNP sedang diproses di background.'
      );
      await startDnpImportPolling(response.jobId);
    } catch (error) {
      stopDnpImportPolling();
      setIsImportingDnp(false);
      setDnpImportError(
        error instanceof Error && error.message
          ? error.message
          : 'Gagal mengambil data compare DNP.'
      );
    }
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
          loadDetail(selectedSubmission, { preferredAnswerId: activeAnswer?.id });
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
        description: 'Hasil audit berhasil dikirim ke user.',
      });
      setFinalizeFiles([]);
      if (finalizeFileInputRef.current) {
        finalizeFileInputRef.current.value = '';
      }
      setForceSendResult(false);
      loadDetail(selectedSubmission, { preferredAnswerId: activeAnswer?.id });
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

  const handleDeleteResultFile = async (fileId: string) => {
    if (isDeletingResultFile) return;
    setIsDeletingResultFile(true);
    try {
      await deleteSelfAssessmentResultFile(fileId);
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
  };

  if (detail && selectedSubmission) {
    const totalQuestions = detail.totalQuestions ?? detail.answers.length;
    const submittedCount = detail.answers.filter(
      (answer) => answer.isSubmitted || !!answer.submittedAt
    ).length;
    const reviewedCount = detail.answers.filter((answer) => !!answer.review?.sentAt).length;
    const isResultComplete =
      submittedCount === totalQuestions && reviewedCount >= submittedCount;
    const totalQuestionPages = Math.max(
      1,
      Math.ceil(detail.answers.length / QUESTION_ITEMS_PER_PAGE)
    );
    const safeQuestionPage = Math.min(questionPage, totalQuestionPages);
    const paginatedAnswers = detail.answers.slice(
      (safeQuestionPage - 1) * QUESTION_ITEMS_PER_PAGE,
      safeQuestionPage * QUESTION_ITEMS_PER_PAGE
    );
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
                {detailPanelMode === 'review' ? (
                  <>
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
                  </>
                ) : null}
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
              {paginatedAnswers.map((answer) => {
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
            {totalQuestionPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500">
                  Halaman {safeQuestionPage} dari {totalQuestionPages}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuestionPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={safeQuestionPage === 1}
                  >
                    Sebelumnya
                  </Button>
                  {Array.from({ length: totalQuestionPages }, (_, index) => {
                    const page = index + 1;
                    const isActive = page === safeQuestionPage;
                    return (
                      <Button
                        key={page}
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        className={
                          isActive ? 'bg-blue-500 text-white hover:bg-blue-600' : undefined
                        }
                        onClick={() => setQuestionPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuestionPage((prev) => Math.min(totalQuestionPages, prev + 1))
                    }
                    disabled={safeQuestionPage === totalQuestionPages}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            ) : null}
            {isAssessmentMode || isImportDnpMode ? (
              <SelfAssessmentDnpLoginPanel
                isImportMode={isImportDnpMode}
                localArea={selectedSubmission.area}
                derivedDnpYear={derivedDnpYear}
                isDnpLoginCollapsed={isDnpLoginCollapsed}
                selectedDnpAreaKey={selectedDnpAreaKey}
                dnpAreas={dnpAreas}
                dnpSessionId={dnpSessionId}
                hasStoredActiveSession={detail?.dnpSession?.active === true}
                hasRunningImportJob={
                  !!detail?.dnpImportJob &&
                  ['queued', 'running'].includes(detail.dnpImportJob.status)
                }
                isLoading={isLoading}
                dnpUsername={dnpUsername}
                dnpPassword={dnpPassword}
                dnpYear={dnpYear}
                dnpCaptchaUrl={dnpCaptchaUrl}
                dnpCaptcha={dnpCaptcha}
                dnpImportError={dnpImportError}
                dnpImportDetail={dnpImportDetail}
                dnpImportMessage={dnpImportMessage}
                isImportingDnp={isImportingDnp}
                onRefreshDnpState={handleRefreshDnpState}
                onToggleCollapsed={() => setIsDnpLoginCollapsed((prev) => !prev)}
                onUsernameChange={setDnpUsername}
                onPasswordChange={setDnpPassword}
                onYearChange={setDnpYear}
                onInitDnpSession={handleInitDnpSession}
                onCaptchaChange={setDnpCaptcha}
                onSelectedAreaKeyChange={setSelectedDnpAreaKey}
                onLoadDnpAreas={handleLoadDnpAreas}
                onImportDnpCompare={handleImportDnpCompare}
                resolveUrl={resolveApiUrl}
                hasCompareSnapshot={Boolean(activeDnpCompare)}
              />
            ) : null}
            {(isAssessmentMode || isImportDnpMode) && activeDnpCompare ? (
              <SelfAssessmentDnpSnapshotPanel
                compareSnapshot={activeDnpCompare}
                answers={detail.answers}
                isAssessmentMode={isAssessmentMode}
                isImportMode={isImportDnpMode}
                dnpMatchThreshold={dnpMatchThreshold}
                matchedAnswerCount={matchedAnswerCount}
                selectedDnpMatches={selectedDnpMatches}
                includeDnpEvidenceOnInject={includeDnpEvidenceOnInject}
                onIncludeDnpEvidenceOnInjectChange={setIncludeDnpEvidenceOnInject}
                onThresholdChange={setDnpMatchThreshold}
                onAutoPair={() => void autoPairDnpMatches()}
                onClearAll={() => void clearAllDnpMatches()}
                dnpQuestionPage={dnpQuestionPage}
                onDnpQuestionPageChange={setDnpQuestionPage}
              />
            ) : null}
            {showResultSubmissionSection ? (
              <SelfAssessmentResultSubmissionPanel
                isResultComplete={isResultComplete}
                finalizeStatus={finalizeStatus}
                onFinalizeStatusChange={setFinalizeStatus}
                fileInputRef={finalizeFileInputRef}
                onFilesChange={setFinalizeFiles}
                resultFiles={detail.result?.files ?? []}
                resolveUrl={resolveApiUrl}
                isDeletingResultFile={isDeletingResultFile}
                onDeleteResultFile={(fileId) => void handleDeleteResultFile(fileId)}
                forceSendResult={forceSendResult}
                onForceSendResultChange={setForceSendResult}
                onSendResult={handleSendResult}
                isSaving={isSaving}
              />
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {activeAnswer ? (
              detailPanelMode === 'assessment' || detailPanelMode === 'importDnp' ? (
                <SelfAssessmentAssessmentEditorPanel
                  activeAnswer={activeAnswer}
                  activeAssessmentInput={{
                    status: activeAssessmentInput?.status ?? 'Satisfactory',
                    comment: activeAssessmentInput?.comment ?? '',
                    evidenceNote: activeAssessmentInput?.evidenceNote ?? '',
                  }}
                  isAssessmentInputDisabled={isAssessmentInputDisabled}
                  isAssessmentLocked={isAssessmentLocked}
                  canOverrideAssessmentLock={canOverrideAssessmentLock}
                  isUploadingEvidence={isUploadingEvidence}
                  isSaving={isSaving}
                  evidenceError={evidenceError}
                  resolveUrl={resolveApiUrl}
                  onAssessmentChange={(value) =>
                    handleAssessmentChange(activeAnswer.id, value)
                  }
                  onAssessmentSave={handleAssessmentSave}
                  onEvidenceUpload={handleAdminEvidenceUpload}
                  onEvidenceDelete={handleAdminEvidenceDelete}
                  dnpPairingPanel={
                    activeDnpCompare ? (
                      <SelfAssessmentDnpAnswerPairingPanel
                        activeAnswer={activeAnswer}
                        isImportMode={isImportDnpMode}
                        dnpMatchThreshold={dnpMatchThreshold}
                        activeBestMatch={activeBestMatch}
                        activeSelectedDnpMatch={activeSelectedDnpMatch}
                        isActiveDnpMatchCollapsed={isActiveDnpMatchCollapsed}
                        activeAnswerMatches={activeAnswerMatches}
                        activeAnswerEvidenceCount={activeAnswerEvidenceCount}
                        selectedMatchCount={Object.keys(selectedDnpMatches).length}
                        totalSelectedEvidenceCount={totalSelectedEvidenceCount}
                        skipDuplicateDnpFileNames={skipDuplicateDnpFileNames}
                        onSkipDuplicateDnpFileNamesChange={setSkipDuplicateDnpFileNames}
                        onToggleCollapse={() => toggleDnpMatchCollapse(activeAnswer.id)}
                        onChooseMatch={(match) =>
                          void chooseDnpMatch(activeAnswer, match)
                        }
                        onClearMatch={() => void clearDnpMatch(activeAnswer.id)}
                        onRunSingleExport={() => runExportToDnp([activeAnswer.id])}
                        onRunBulkExport={() => runExportToDnp()}
                        onRunSingleInject={() =>
                          void runInjectFromDnp([activeAnswer.id])
                        }
                        onRunBulkInject={() => void runInjectFromDnp()}
                        isExportingToDnp={isExportingToDnp}
                        isInjectingFromDnp={isInjectingFromDnp}
                        exportResult={dnpExportResult}
                      />
                    ) : null
                  }
                />
              ) : (
                <SelfAssessmentReviewDetailPanel
                  activeAnswer={activeAnswer}
                  reviewLabel={reviewLabel}
                  reviewInput={{
                    status: reviewInputs[activeAnswer.id]?.status ?? 'Satisfactory',
                    severity: reviewInputs[activeAnswer.id]?.severity ?? '',
                    probability: reviewInputs[activeAnswer.id]?.probability ?? '',
                    resume: reviewInputs[activeAnswer.id]?.resume ?? '',
                    description: reviewInputs[activeAnswer.id]?.description ?? '',
                    finding: reviewInputs[activeAnswer.id]?.finding ?? '',
                    recommendations:
                      reviewInputs[activeAnswer.id]?.recommendations ?? '',
                    remark: reviewInputs[activeAnswer.id]?.remark ?? '',
                  }}
                  sendMode={sendMode}
                  onSendModeChange={setSendMode}
                  onReviewChange={(value) =>
                    handleReviewChange(activeAnswer.id, value)
                  }
                  onSubmitDraft={() => submitReviews([activeAnswer.id], 'draft')}
                  onSubmitSend={() => submitReviews([activeAnswer.id], 'send')}
                  isSaving={isSaving}
                  resolveUrl={resolveApiUrl}
                />
              )
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
      <SelfAssessmentWorkspace
        outerIcon={<ClipboardCheck className="h-5 w-5" />}
        outerTitle="Protocol Question (PQ)"
        outerContextLabel="Admin"
        outerCurrentLabel={title}
        innerIcon={<FileText className="h-5 w-5" />}
        innerTitle="Data Self Assessment"
        innerDescription={description}
        headerAction={
          <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            {badgeLabel}
          </span>
        }
      >
        <SelfAssessmentListFilters
          month={month}
          monthOptions={MONTH_OPTIONS}
          onMonthChange={setMonth}
          year={year}
          yearOptions={YEAR_OPTIONS}
          onYearChange={setYear}
          searchText={searchText}
          onSearchTextChange={setSearchText}
          onSearch={loadSubmissions}
          onReset={() => {
            if (!lockScope) {
              setScope(resolvedInitialScope as SelfAssessmentScope | 'all');
            }
            setMonth(MONTH_OPTIONS[0].value);
            setYear(YEAR_OPTIONS[0]);
            setSelectedUserId('all');
            setSearchText('');
          }}
          leadingControls={
            !hideScopeFilter || detailPanelMode === 'importDnp' ? (
              <>
                {!hideScopeFilter ? (
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
                ) : null}
                {detailPanelMode === 'importDnp' ? (
                  <select
                    className="h-11 rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100"
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                  >
                    {userFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </>
            ) : undefined
          }
        />

        <div className="px-6 pb-6">
          <SelfAssessmentSubmissionTable
            rows={submissionRows}
            isLoading={isLoading}
            loadingMessage="Memuat data..."
            emptyMessage="Belum ada data terkirim."
            totalCount={filteredSubmissions.length}
            showScopeColumn
            showUserColumn
            showActionColumn
          />
        </div>
      </SelfAssessmentWorkspace>
    </div>
  );
}
