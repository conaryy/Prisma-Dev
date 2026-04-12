import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ClipboardCheck,
  FileText,
  UploadCloud,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { FormField, FormSection } from '@/components/shared/Form';
import {
  SelfAssessmentSubmissionTable,
  type SelfAssessmentSubmissionTableRow,
} from '@/components/self-assessment/SelfAssessmentSubmissionTable';
import {
  SelfAssessmentListFilters,
  SelfAssessmentWorkspace,
} from '@/components/self-assessment/SelfAssessmentWorkspace';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { resolveApiUrl } from '@/lib/api';
import {
  SELF_ASSESSMENT_MONTH_OPTIONS as MONTH_OPTIONS,
  SELF_ASSESSMENT_YEAR_OPTIONS as YEAR_OPTIONS,
} from '@/lib/selfAssessmentFilters';
import {
  fetchAdminSelfAssessmentExportDnpAreas,
  deleteAdminSelfAssessmentEvidence,
  deleteSelfAssessmentResultFile,
  fetchAdminSelfAssessmentExportDnpImportJob,
  fetchAdminSelfAssessmentSubmissionDetail,
  fetchAdminSelfAssessmentSubmissions,
  exportAdminSelfAssessmentToDnp,
  finalizeSelfAssessmentResult,
  importAdminSelfAssessmentExportDnp,
  initAdminSelfAssessmentExportDnpSession,
  saveAdminSelfAssessmentExportDnpMatches,
  submitAdminSelfAssessmentAnswers,
  submitAdminSelfAssessmentReviews,
  uploadAdminSelfAssessmentEvidence,
  type SelfAssessmentExportDnpCompareSnapshot,
  type SelfAssessmentExportDnpAreaTarget,
  type SelfAssessmentExportDnpImportJobResponse,
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
const TOP_DNP_MATCH_CANDIDATES = 3;

type QuestionMatchCandidate = {
  id: string;
  questionCode: string;
  questionText: string;
  reference?: string | null;
  similarity: number;
};

type SelectedDnpMatch = QuestionMatchCandidate & {
  answerId: string;
  localQuestionCode: string;
  localQuestionText: string;
};

const normalizeQuestionForMatch = (value: string | null | undefined) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b[a-z]+\.\d+\b/g, ' ')
    .replace(/\b[a-z]+\b(?=\s*-\s*)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildWordBigrams = (value: string) => {
  const words = value.split(' ').filter(Boolean);
  if (words.length <= 1) {
    return words;
  }

  const pairs: string[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    pairs.push(`${words[index]} ${words[index + 1]}`);
  }
  return pairs;
};

const calculateQuestionSimilarity = (source: string, target: string) => {
  const normalizedSource = normalizeQuestionForMatch(source);
  const normalizedTarget = normalizeQuestionForMatch(target);

  if (!normalizedSource || !normalizedTarget) {
    return 0;
  }

  if (normalizedSource === normalizedTarget) {
    return 100;
  }

  const sourceTokens = normalizedSource.split(' ').filter(Boolean);
  const targetTokens = normalizedTarget.split(' ').filter(Boolean);
  const sourceTokenSet = new Set(sourceTokens);
  const targetTokenSet = new Set(targetTokens);
  const commonTokenCount = [...sourceTokenSet].filter((token) =>
    targetTokenSet.has(token)
  ).length;
  const tokenScore =
    (2 * commonTokenCount) / (sourceTokenSet.size + targetTokenSet.size || 1);

  const sourceBigrams = buildWordBigrams(normalizedSource);
  const targetBigrams = buildWordBigrams(normalizedTarget);
  const sourceBigramSet = new Set(sourceBigrams);
  const targetBigramSet = new Set(targetBigrams);
  const commonBigramCount = [...sourceBigramSet].filter((token) =>
    targetBigramSet.has(token)
  ).length;
  const bigramScore =
    (2 * commonBigramCount) /
    (sourceBigramSet.size + targetBigramSet.size || 1);

  const coverageScore = sourceTokens.length
    ? commonTokenCount / sourceTokens.length
    : 0;

  const weightedScore = tokenScore * 0.5 + bigramScore * 0.35 + coverageScore * 0.15;
  return Math.max(0, Math.min(100, Math.round(weightedScore * 100)));
};

const getMatchTone = (similarity: number, threshold: number) => {
  if (similarity >= Math.max(threshold, 85)) {
    return 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200';
  }
  if (similarity >= threshold) {
    return 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200';
  }
  if (similarity >= Math.max(50, threshold - 10)) {
    return 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200';
  }
  return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200';
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
  detailPanelMode?: 'review' | 'assessment';
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
  const [dnpQuestionPage, setDnpQuestionPage] = useState(1);
  const [dnpSessionId, setDnpSessionId] = useState('');
  const [dnpCaptchaUrl, setDnpCaptchaUrl] = useState('');
  const [dnpUsername, setDnpUsername] = useState('');
  const [dnpPassword, setDnpPassword] = useState('');
  const [dnpCaptcha, setDnpCaptcha] = useState('');
  const [dnpYear, setDnpYear] = useState('');
  const [dnpAreas, setDnpAreas] = useState<SelfAssessmentExportDnpAreaTarget[]>([]);
  const [selectedDnpAreaKey, setSelectedDnpAreaKey] = useState('');
  const [dnpImportError, setDnpImportError] = useState<string | null>(null);
  const [dnpImportMessage, setDnpImportMessage] = useState<string | null>(null);
  const [dnpImportDetail, setDnpImportDetail] = useState<string | null>(null);
  const [isImportingDnp, setIsImportingDnp] = useState(false);
  const [isDnpLoginCollapsed, setIsDnpLoginCollapsed] = useState(false);
  const [dnpMatchThreshold, setDnpMatchThreshold] = useState(
    DEFAULT_DNP_MATCH_THRESHOLD
  );
  const [selectedDnpMatches, setSelectedDnpMatches] = useState<
    Record<string, SelectedDnpMatch>
  >({});
  const [collapsedDnpMatches, setCollapsedDnpMatches] = useState<
    Record<string, boolean>
  >({});
  const [isExportingToDnp, setIsExportingToDnp] = useState(false);
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
  const dnpImportPollRef = useRef<number | null>(null);
  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;

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
  const submissionRows: SelfAssessmentSubmissionTableRow[] = filteredSubmissions.map(
    (item, index) => ({
      id: `${item.sessionAreaId}-${item.user?.id ?? index}`,
      scope: item.scope,
      areas: [{ id: item.sessionAreaId, label: item.area }],
      userName: item.user?.name ?? '-',
      leader: item.leader,
      members: item.dnp,
      auditees: item.kobo,
      schedule: formatScheduleDisplay(item.schedule, '-'),
      action: {
        label: 'Review',
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

  const stopDnpImportPolling = () => {
    if (dnpImportPollRef.current !== null) {
      window.clearTimeout(dnpImportPollRef.current);
      dnpImportPollRef.current = null;
    }
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
        setQuestionPage(1);
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
        const restoredMatches = Object.fromEntries(
          (data.dnpCompare?.selectedMatches ?? [])
            .filter((item) => item.answerId && item.dnpSnapshotItemId)
            .map((item) => [
              item.answerId,
              {
                id: item.dnpSnapshotItemId,
                questionCode: item.dnpQuestionCode ?? '-',
                questionText: item.dnpQuestionText ?? '',
                reference: item.dnpReference ?? '',
                similarity: item.similarity ?? 0,
                answerId: item.answerId,
                localQuestionCode: item.localQuestionCode ?? '',
                localQuestionText: item.localQuestionText ?? '',
              },
            ])
        );
        setSelectedDnpMatches(restoredMatches);
        setCollapsedDnpMatches(
          Object.fromEntries(Object.keys(restoredMatches).map((key) => [key, true]))
        );
        if (data.dnpImportJob?.jobId && ['queued', 'running'].includes(data.dnpImportJob.status)) {
          setIsImportingDnp(true);
          setDnpImportMessage(
            data.dnpImportJob.message || 'Pengambilan data export DNP masih berjalan.'
          );
          stopDnpImportPolling();
          void pollDnpImportJob(data.dnpImportJob.jobId);
        } else {
          setIsImportingDnp(false);
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
            status: answer.status ?? 'Satisfactory',
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
    loadDetail(selectedSubmission);
  };

  const activeAnswer = detail?.answers.find((answer) => answer.id === activeAnswerId);
  const activeDnpCompare = detail?.dnpCompare ?? null;
  const dnpMatchesByAnswerId = useMemo(() => {
    if (!detail?.answers.length || !activeDnpCompare?.items.length) {
      return {} as Record<string, QuestionMatchCandidate[]>;
    }

    return detail.answers.reduce<Record<string, QuestionMatchCandidate[]>>(
      (accumulator, answer) => {
        const matches = activeDnpCompare.items
          .map((item) => ({
            id: item.id,
            questionCode: item.questionCode ?? '-',
            questionText: item.questionText ?? '',
            reference: item.reference ?? '',
            similarity: calculateQuestionSimilarity(
              answer.questionText,
              item.questionText ?? ''
            ),
          }))
          .filter((item) => item.similarity > 0)
          .sort((left, right) => right.similarity - left.similarity)
          .slice(0, TOP_DNP_MATCH_CANDIDATES);

        accumulator[answer.id] = matches;
        return accumulator;
      },
      {}
    );
  }, [detail?.answers, activeDnpCompare?.items]);
  const matchedAnswerCount = useMemo(
    () =>
      detail?.answers.filter(
        (answer) =>
          (dnpMatchesByAnswerId[answer.id]?.[0]?.similarity ?? 0) >= dnpMatchThreshold
      ).length ?? 0,
    [detail?.answers, dnpMatchesByAnswerId, dnpMatchThreshold]
  );
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
  const totalSelectedEvidenceCount = useMemo(() => {
    if (!detail?.answers.length) {
      return 0;
    }

    return detail.answers.reduce((total, answer) => {
      if (!selectedDnpMatches[answer.id]) {
        return total;
      }
      return total + answer.evidence.length;
    }, 0);
  }, [detail?.answers, selectedDnpMatches]);
  const activeAssessmentInput = activeAnswer
    ? assessmentInputs[activeAnswer.id] ?? {
        status: activeAnswer.status ?? 'Satisfactory',
        comment: activeAnswer.comment ?? '',
        evidenceNote: activeAnswer.evidenceNote ?? '',
      }
    : null;
  const isAssessmentLocked = activeAnswer?.review?.isFinal ?? false;
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
        status: value.status ?? prev[answerId]?.status ?? 'Satisfactory',
        comment: value.comment ?? prev[answerId]?.comment ?? '',
        evidenceNote: value.evidenceNote ?? prev[answerId]?.evidenceNote ?? '',
      },
    }));
  };

  const persistDnpMatches = async (
    nextMatches: Record<string, SelectedDnpMatch>,
    options?: { silent?: boolean }
  ) => {
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
        title: 'Mapping export tersimpan',
        description: 'Pilihan target pertanyaan DNP berhasil disimpan.',
      });
    }
  };

  const handleChooseDnpMatch = async (
    answer: SubmissionDetail['answers'][number],
    match: QuestionMatchCandidate
  ) => {
    const nextMatches = {
      ...selectedDnpMatches,
      [answer.id]: {
        ...match,
        answerId: answer.id,
        localQuestionCode: answer.questionCode,
        localQuestionText: answer.questionText,
      },
    };
    setSelectedDnpMatches(nextMatches);
    setCollapsedDnpMatches((prev) => ({
      ...prev,
      [answer.id]: true,
    }));
    try {
      await persistDnpMatches(nextMatches, { silent: true });
      toast({
        title: 'Target export dipilih',
        description: `${answer.questionCode} diarahkan ke PQ DNP ${match.questionCode}.`,
      });
    } catch (error) {
      setSelectedDnpMatches((prev) => {
        const fallback = { ...prev };
        delete fallback[answer.id];
        return fallback;
      });
      setCollapsedDnpMatches((prev) => ({
        ...prev,
        [answer.id]: false,
      }));
      toast({
        title: 'Gagal menyimpan target export',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    }
  };

  const handleToggleDnpMatchCollapse = (answerId: string) => {
    setCollapsedDnpMatches((prev) => ({
      ...prev,
      [answerId]: !prev[answerId],
    }));
  };

  const handleClearDnpMatch = async (answerId: string) => {
    const previousMatch = selectedDnpMatches[answerId];
    const nextMatches = { ...selectedDnpMatches };
    delete nextMatches[answerId];

    setSelectedDnpMatches(nextMatches);
    setCollapsedDnpMatches((prev) => ({
      ...prev,
      [answerId]: false,
    }));

    try {
      await persistDnpMatches(nextMatches, { silent: true });
      toast({
        title: 'Pilihan target dibatalkan',
        description: 'Pertanyaan lokal ini tidak lagi diarahkan ke PQ DNP.',
      });
    } catch (error) {
      setSelectedDnpMatches((prev) => ({
        ...prev,
        ...(previousMatch ? { [answerId]: previousMatch } : {}),
      }));
      setCollapsedDnpMatches((prev) => ({
        ...prev,
        [answerId]: true,
      }));
      toast({
        title: 'Gagal membatalkan target export',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    }
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
      });

      toast({
        title: 'Perubahan tersimpan',
        description: 'Data self assessment berhasil diperbarui.',
      });

      if (selectedSubmission) {
        loadDetail(selectedSubmission);
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
        });
      }

      if (selectedSubmission) {
        loadDetail(selectedSubmission);
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
      await deleteAdminSelfAssessmentEvidence(evidenceId);
      loadDetail(selectedSubmission);
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
      const data = await initAdminSelfAssessmentExportDnpSession();
      setDnpSessionId(data.sessionId);
      setDnpCaptchaUrl(data.captchaUrl);
      setDnpCaptcha('');
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
      const yearNumber = Number(dnpYear || derivedDnpYear);
      if (Number.isNaN(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
        setDnpImportError('Tahun DNP tidak valid.');
        setIsImportingDnp(false);
        return;
      }
      const response = await fetchAdminSelfAssessmentExportDnpAreas({
        sessionAreaId: selectedSubmission.sessionAreaId,
        sessionId: dnpSessionId,
        username: dnpUsername,
        password: dnpPassword,
        captcha: dnpCaptcha,
        year: yearNumber,
      });
      setDnpAreas(response.areas);
      setSelectedDnpAreaKey(
        response.areas[0]
          ? `${response.areas[0].fillCode1}::${response.areas[0].fillCode2}`
          : ''
      );
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

  const pollDnpImportJob = async (jobId: string): Promise<void> => {
    const response: SelfAssessmentExportDnpImportJobResponse =
      await fetchAdminSelfAssessmentExportDnpImportJob(jobId);

    if (response.status === 'queued' || response.status === 'running') {
      setDnpImportMessage(
        response.message || 'Pengambilan data export DNP masih berjalan.'
      );
      dnpImportPollRef.current = window.setTimeout(() => {
        void pollDnpImportJob(jobId);
      }, 3000);
      return;
    }

    stopDnpImportPolling();
    setIsImportingDnp(false);

    if (response.status === 'failed') {
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
      return;
    }

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
  };

  const handleImportDnpCompare = async () => {
    if (!selectedSubmission?.user || !detail) {
      return;
    }
    if (!dnpSessionId) {
      setDnpImportError('Buat sesi DNP terlebih dahulu.');
      return;
    }
    const selectedArea = dnpAreas.find(
      (item) => `${item.fillCode1}::${item.fillCode2}` === selectedDnpAreaKey
    );
    if (!selectedArea) {
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
        fillCode1: selectedArea.fillCode1,
        fillCode2: selectedArea.fillCode2,
        fillArea: selectedArea.area,
      });
      if (!response.jobId) {
        throw new Error('Job import DNP tidak tersedia.');
      }
      setDnpImportMessage(
        response.message || 'Pengambilan data export DNP sedang diproses di background.'
      );
      await pollDnpImportJob(response.jobId);
    } catch (error) {
      stopDnpImportPolling();
      setIsImportingDnp(false);
      setDnpImportError(
        error instanceof Error && error.message
          ? error.message
          : 'Gagal mengambil data compare DNP.'
      );
    } finally {
      if (dnpImportPollRef.current === null) {
        setIsImportingDnp(false);
      }
    }
  };

  useEffect(() => () => stopDnpImportPolling(), []);

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
    const totalQuestionPages = Math.max(
      1,
      Math.ceil(detail.answers.length / QUESTION_ITEMS_PER_PAGE)
    );
    const safeQuestionPage = Math.min(questionPage, totalQuestionPages);
    const paginatedAnswers = detail.answers.slice(
      (safeQuestionPage - 1) * QUESTION_ITEMS_PER_PAGE,
      safeQuestionPage * QUESTION_ITEMS_PER_PAGE
    );
    const totalDnpQuestionPages = Math.max(
      1,
      Math.ceil((activeDnpCompare?.items.length ?? 0) / QUESTION_ITEMS_PER_PAGE)
    );
    const safeDnpQuestionPage = Math.min(dnpQuestionPage, totalDnpQuestionPages);
    const paginatedDnpItems = (activeDnpCompare?.items ?? []).slice(
      (safeDnpQuestionPage - 1) * QUESTION_ITEMS_PER_PAGE,
      safeDnpQuestionPage * QUESTION_ITEMS_PER_PAGE
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
            {detailPanelMode === 'assessment' ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-700">
                      Login DNP Untuk Export
                    </div>
                    <div className="text-xs text-slate-500">
                      Area lokal: {selectedSubmission.area} • Tahun: {derivedDnpYear}
                    </div>
                    {isDnpLoginCollapsed ? (
                      <div className="text-xs text-slate-500">
                        Area DNP: {dnpAreas.find(
                          (item) => `${item.fillCode1}::${item.fillCode2}` === selectedDnpAreaKey
                        )?.area || '-'}
                        {dnpSessionId ? ` • Session: ${dnpSessionId}` : ''}
                      </div>
                    ) : null}
                    {detail?.dnpSession?.active ? (
                      <div className="text-xs text-emerald-400">
                        Sesi DNP aktif tersimpan dan siap direuse.
                      </div>
                    ) : null}
                    {detail?.dnpImportJob && ['queued', 'running'].includes(detail.dnpImportJob.status) ? (
                      <div className="text-xs text-amber-400">
                        Sedang proses update data DNP.
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshDnpState}
                      disabled={isLoading}
                    >
                      Refresh
                    </Button>
                    {activeDnpCompare ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDnpLoginCollapsed((prev) => !prev)}
                      >
                        {isDnpLoginCollapsed ? 'Buka Lagi' : 'Minimize'}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {!isDnpLoginCollapsed ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <FormField label="Username DNP" required>
                        <Input
                          value={dnpUsername}
                          onChange={(event) => setDnpUsername(event.target.value)}
                          placeholder="Username DNP"
                        />
                      </FormField>
                      <FormField label="Password DNP" required>
                        <Input
                          type="password"
                          value={dnpPassword}
                          onChange={(event) => setDnpPassword(event.target.value)}
                          placeholder="Password DNP"
                        />
                      </FormField>
                      <FormField label="Tahun DNP" required>
                        <Input
                          type="number"
                          min={2000}
                          max={2100}
                          value={dnpYear}
                          onChange={(event) => setDnpYear(event.target.value)}
                          placeholder="Tahun"
                        />
                      </FormField>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleInitDnpSession}
                        disabled={isImportingDnp}
                      >
                        Muat Captcha
                      </Button>
                      {dnpSessionId ? (
                        <span className="text-xs text-slate-500">Session: {dnpSessionId}</span>
                      ) : null}
                    </div>
                    {dnpCaptchaUrl ? (
                      <div className="space-y-3">
                        <img
                          src={resolveApiUrl(dnpCaptchaUrl)}
                          alt="Captcha DNP"
                          className="h-16 rounded-lg border border-slate-200 bg-white px-3 py-2"
                        />
                        <FormField label="Captcha" required>
                          <Input
                            value={dnpCaptcha}
                            onChange={(event) => setDnpCaptcha(event.target.value)}
                            placeholder="Masukkan captcha"
                          />
                        </FormField>
                      </div>
                    ) : null}
                    {dnpAreas.length > 0 ? (
                      <FormField label="Area DNP" required>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                          value={selectedDnpAreaKey}
                          onChange={(event) => setSelectedDnpAreaKey(event.target.value)}
                        >
                          {dnpAreas.map((item) => (
                            <option
                              key={`${item.fillCode1}-${item.fillCode2}`}
                              value={`${item.fillCode1}::${item.fillCode2}`}
                            >
                              {item.area}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    ) : null}
                  </>
                ) : null}
                {dnpImportError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {dnpImportError}
                  </div>
                ) : null}
                {dnpImportDetail ? (
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    {dnpImportDetail}
                  </pre>
                ) : null}
                {dnpImportMessage ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    {dnpImportMessage}
                  </div>
                ) : null}
                {!isDnpLoginCollapsed ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleLoadDnpAreas}
                      disabled={
                        isImportingDnp ||
                        !dnpSessionId ||
                        !dnpUsername.trim() ||
                        !dnpPassword.trim() ||
                        !dnpCaptcha.trim() ||
                        !dnpYear.trim()
                      }
                    >
                      Ambil Daftar Area
                    </Button>
                    <Button
                      className="bg-blue-500 text-white hover:bg-blue-600"
                      onClick={handleImportDnpCompare}
                      disabled={
                        isImportingDnp ||
                        !dnpSessionId ||
                        !dnpUsername.trim() ||
                        !dnpPassword.trim() ||
                        !dnpCaptcha.trim() ||
                        !dnpYear.trim() ||
                        !selectedDnpAreaKey
                      }
                    >
                      {isImportingDnp ? 'Mengambil Data DNP...' : 'Ambil Data Area DNP'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {detailPanelMode === 'assessment' && activeDnpCompare ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">Pertanyaan DNP</div>
                    <div className="text-xs text-slate-500">
                      Target: {activeDnpCompare.fillArea || '-'} • Import:{' '}
                      {activeDnpCompare.importedAt || '-'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {activeDnpCompare.items.length} item
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
                      Match {matchedAnswerCount} / {detail.answers.length}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-[1fr_auto] md:items-end">
                  <FormField label="Ambang Kecocokan Pertanyaan">
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={40}
                        max={100}
                        step={5}
                        value={dnpMatchThreshold}
                        onChange={(event) =>
                          setDnpMatchThreshold(Number(event.target.value))
                        }
                        className="w-full accent-blue-500"
                      />
                      <div className="text-xs text-slate-500">
                        Pertanyaan dianggap cocok bila similarity minimal{' '}
                        <span className="font-semibold text-slate-700">
                          {dnpMatchThreshold}%
                        </span>
                        .
                      </div>
                    </div>
                  </FormField>
                  <div className="rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
                    Dipakai untuk penyamaan pertanyaan lokal dengan DNP sebelum export.
                  </div>
                </div>
                {paginatedDnpItems.length > 0 ? (
                  <div className="overflow-hidden divide-y rounded-xl border border-slate-200">
                    {paginatedDnpItems.map((item) => {
                      const bestLocalMatch = detail.answers
                        .map((answer) => ({
                          answer,
                          similarity: calculateQuestionSimilarity(
                            answer.questionText,
                            item.questionText ?? ''
                          ),
                        }))
                        .sort((left, right) => right.similarity - left.similarity)[0];
                      const assignedLocalMatches = Object.values(selectedDnpMatches).filter(
                        (match) => match.id === item.id
                      );

                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 bg-slate-50 px-3 py-3 text-sm"
                        >
                          <span className="mt-1 text-xs font-semibold text-slate-500">
                            {item.questionCode || '-'}
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="text-slate-700">{item.questionText || '-'}</div>
                            {assignedLocalMatches.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {assignedLocalMatches.map((match) => (
                                  <span
                                    key={`${item.id}-${match.answerId}`}
                                    className="rounded-full border border-blue-200 bg-blue-100 px-2 py-1 font-semibold text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200"
                                  >
                                    Cocok dengan {match.localQuestionCode}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {bestLocalMatch ? (
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span
                                  className={`rounded-full px-2 py-1 font-semibold ${getMatchTone(
                                    bestLocalMatch.similarity,
                                    dnpMatchThreshold
                                  )}`}
                                >
                                  {bestLocalMatch.similarity}%
                                </span>
                                <span className="text-slate-500">
                                  Kandidat lokal: {bestLocalMatch.answer.questionCode} -{' '}
                                  {bestLocalMatch.answer.questionText}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Belum ada item pertanyaan DNP yang tersimpan.
                  </div>
                )}
                {activeDnpCompare.items.length > QUESTION_ITEMS_PER_PAGE ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Halaman {safeDnpQuestionPage} dari {totalDnpQuestionPages}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDnpQuestionPage((prev) => Math.max(1, prev - 1))}
                        disabled={safeDnpQuestionPage === 1}
                      >
                        Sebelumnya
                      </Button>
                      {Array.from({ length: totalDnpQuestionPages }, (_, index) => {
                        const page = index + 1;
                        const isActive = page === safeDnpQuestionPage;
                        return (
                          <Button
                            key={page}
                            size="sm"
                            variant={isActive ? 'default' : 'outline'}
                            className={
                              isActive ? 'bg-blue-500 text-white hover:bg-blue-600' : undefined
                            }
                            onClick={() => setDnpQuestionPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDnpQuestionPage((prev) => Math.min(totalDnpQuestionPages, prev + 1))
                        }
                        disabled={safeDnpQuestionPage === totalDnpQuestionPages}
                      >
                        Selanjutnya
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {showResultSubmissionSection ? (
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
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {activeAnswer ? (
              detailPanelMode === 'assessment' ? (
                <>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">
                      Upload file evidence <span className="text-red-500">*</span>
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Your file will be upload to server
                    </p>
                  </div>
                  <div
                    className={`relative flex min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center ${
                      isAssessmentLocked ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
                      <UploadCloud className="h-6 w-6 text-slate-400" />
                      Drop files here or click to upload.
                    </div>
                    <input
                      type="file"
                      multiple
                      className={`absolute inset-0 h-full w-full opacity-0 ${
                        isAssessmentLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,.mp3,.mp4"
                      onChange={handleAdminEvidenceUpload}
                      disabled={isAssessmentLocked || isUploadingEvidence || isSaving}
                    />
                  </div>
                  {isUploadingEvidence ? (
                    <div className="text-xs text-slate-500">Mengunggah file...</div>
                  ) : null}
                  {activeAnswer.evidence.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      <div className="mb-2 text-xs font-semibold text-slate-600">
                        File evidence existing
                      </div>
                      <div className="space-y-2">
                        {activeAnswer.evidence.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                          >
                            <a
                              href={resolveApiUrl(item.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-blue-600 underline"
                            >
                              {item.name}
                            </a>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isAssessmentLocked || isUploadingEvidence || isSaving}
                              onClick={() => handleAdminEvidenceDelete(item.id)}
                            >
                              Hapus
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                      Belum ada evidence.
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    *File yang diperbolehkan: JPG, JPEG, PDF, DOCX, PNG, MP3, MP4,
                    XLSX
                    <br />
                    *Max size : 20MB
                  </div>
                  {evidenceError ? (
                    <div className="text-xs text-red-500">{evidenceError}</div>
                  ) : null}
                  {isAssessmentLocked ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Jawaban sudah difinalisasi dan tidak bisa diubah.
                    </div>
                  ) : null}

                  <FormSection title="Data Assessment">
                    <div className="grid gap-4">
                      {activeDnpCompare ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-700">
                                Compare Pertanyaan Lokal vs DNP
                              </div>
                              <div className="text-xs text-slate-500">
                                Penyamaan berbasis similarity isi pertanyaan.
                              </div>
                            </div>
                            {activeBestMatch ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {activeSelectedDnpMatch ? (
                                  <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200">
                                    Dipilih: {activeSelectedDnpMatch.questionCode}
                                  </span>
                                ) : null}
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getMatchTone(
                                    activeBestMatch.similarity,
                                    dnpMatchThreshold
                                  )}`}
                                >
                                  Best match {activeBestMatch.similarity}%
                                </span>
                              </div>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                Belum ada kandidat
                              </span>
                            )}
                          </div>
                          {activeSelectedDnpMatch ? (
                            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-slate-700">
                                    Target export dipilih
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {activeAnswer.questionCode} akan diarahkan ke PQ DNP{' '}
                                    {activeSelectedDnpMatch.questionCode}.
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Evidence lokal yang ikut dikirim: {activeAnswerEvidenceCount}{' '}
                                    file.
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="bg-blue-500 text-white hover:bg-blue-600"
                                    onClick={() => runExportToDnp([activeAnswer.id])}
                                    disabled={isExportingToDnp}
                                  >
                                    {isExportingToDnp
                                      ? 'Mengirim...'
                                      : `Export Pertanyaan Ini (${activeAnswer.questionCode})`}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleToggleDnpMatchCollapse(activeAnswer.id)
                                    }
                                  >
                                    {isActiveDnpMatchCollapsed ? 'Buka Lagi' : 'Minimize'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          {!activeSelectedDnpMatch || !isActiveDnpMatchCollapsed ? (
                            <div className="mt-3 space-y-3">
                              {activeAnswerMatches.length > 0 ? (
                                activeAnswerMatches.map((match, index) => {
                                  const isQualified = match.similarity >= dnpMatchThreshold;
                                  const isSelected = activeSelectedDnpMatch?.id === match.id;
                                  return (
                                    <div
                                      key={match.id}
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-xs font-semibold text-slate-500">
                                            Kandidat {index + 1}
                                          </span>
                                          <span
                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${getMatchTone(
                                              match.similarity,
                                              dnpMatchThreshold
                                            )}`}
                                          >
                                            {match.similarity}%
                                          </span>
                                          <span className="text-xs text-slate-500">
                                            {isQualified
                                              ? 'Layak dipertimbangkan untuk export'
                                              : 'Masih di bawah ambang match'}
                                          </span>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant={isSelected ? 'outline' : 'default'}
                                          className={
                                            isSelected
                                              ? undefined
                                              : 'bg-blue-500 text-white hover:bg-blue-600'
                                          }
                                          onClick={() => {
                                            if (isSelected) {
                                              void handleClearDnpMatch(activeAnswer.id);
                                              return;
                                            }
                                            void handleChooseDnpMatch(activeAnswer, match);
                                          }}
                                        >
                                          {isSelected ? 'Batalkan Pilihan' : 'Pilih / Ganti Target'}
                                        </Button>
                                      </div>
                                      <div className="mt-2 text-xs font-semibold text-slate-500">
                                        {match.questionCode}
                                      </div>
                                      <div className="text-sm text-slate-700">
                                        {match.questionText || '-'}
                                      </div>
                                      {match.reference ? (
                                        <div className="mt-2 text-xs text-slate-500">
                                          Referensi DNP: {match.reference}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                                  Belum ada pertanyaan DNP untuk dibandingkan pada area ini.
                                </div>
                              )}
                            </div>
                          ) : null}
                          {Object.keys(selectedDnpMatches).length > 0 ? (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-slate-700">
                                    Export Semua Pairing Area Ini
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Kirim semua pertanyaan lokal yang sudah dipasangkan ke draft DNP.
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Pairing terpilih: {Object.keys(selectedDnpMatches).length} •
                                    Evidence lokal yang ikut dikirim: {totalSelectedEvidenceCount}{' '}
                                    file.
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-blue-500 text-white hover:bg-blue-600"
                                  onClick={() => runExportToDnp()}
                                  disabled={isExportingToDnp}
                                >
                                  {isExportingToDnp
                                    ? 'Mengirim semua...'
                                    : `Export Semua Pairing (${Object.keys(selectedDnpMatches).length})`}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                          {dnpExportResult ? (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-800 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-100">
                                  Total {dnpExportResult.summary.total}
                                </span>
                                <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
                                  Berhasil {dnpExportResult.summary.success}
                                </span>
                                <span className="rounded-full border border-red-200 bg-red-100 px-2 py-1 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
                                  Gagal {dnpExportResult.summary.failed}
                                </span>
                                <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                                  Dilewati {dnpExportResult.summary.skipped}
                                </span>
                              </div>
                              <div className="mt-3 space-y-2">
                                {dnpExportResult.results.map((item) => (
                                  <div
                                    key={`${item.answerId}-${item.dnpQuestionCode}`}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-slate-700">
                                        {item.localQuestionCode} {'->'} {item.dnpQuestionCode || '-'}
                                      </span>
                                      <span
                                        className={`rounded-full border px-2 py-1 font-semibold ${
                                          item.status === 'success'
                                            ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200'
                                            : item.status === 'failed'
                                            ? 'border-red-200 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200'
                                            : 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200'
                                        }`}
                                      >
                                        {item.status}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-slate-500">{item.message}</div>
                                    {item.uploads && item.uploads.length > 0 ? (
                                      <div className="mt-2 space-y-1">
                                        {item.uploads.map((upload) => (
                                          <div
                                            key={upload.evidenceId}
                                            className="rounded-md bg-white px-2 py-2 text-[11px]"
                                          >
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-semibold text-slate-700">
                                                File: {upload.fileName}
                                              </span>
                                              <span
                                                className={`rounded-full border px-2 py-1 font-semibold ${
                                                  upload.status === 'success'
                                                    ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200'
                                                    : upload.status === 'failed'
                                                    ? 'border-red-200 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200'
                                                    : 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200'
                                                }`}
                                              >
                                                {upload.status}
                                              </span>
                                            </div>
                                            <div className="mt-1 text-slate-500">
                                              {upload.message}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <FormField label="Protocol Question">
                        <Textarea rows={3} value={activeAnswer.questionText} disabled />
                      </FormField>
                      <FormField label="Referensi Regulasi">
                        <Textarea rows={2} value={activeAnswer.reference ?? ''} disabled />
                      </FormField>
                      <FormField label="Status of Implementation" required>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                          value={activeAssessmentInput?.status ?? 'Satisfactory'}
                          onChange={(event) =>
                            handleAssessmentChange(activeAnswer.id, {
                              status: event.target.value,
                            })
                          }
                          disabled={isAssessmentLocked}
                        >
                          <option value="Satisfactory">Satisfactory</option>
                          <option value="Not Satisfactory">Not Satisfactory</option>
                          <option value="Not Aplicable">Not Aplicable</option>
                        </select>
                      </FormField>
                      <FormField label="Comment">
                        <Textarea
                          rows={3}
                          value={activeAssessmentInput?.comment ?? ''}
                          onChange={(event) =>
                            handleAssessmentChange(activeAnswer.id, {
                              comment: event.target.value,
                            })
                          }
                          disabled={isAssessmentLocked}
                        />
                      </FormField>
                      <FormField label="Evidence Notes">
                        <Textarea
                          rows={3}
                          value={activeAssessmentInput?.evidenceNote ?? ''}
                          onChange={(event) =>
                            handleAssessmentChange(activeAnswer.id, {
                              evidenceNote: event.target.value,
                            })
                          }
                          disabled={isAssessmentLocked}
                        />
                      </FormField>
                      <div className="text-xs text-red-500">
                        Kolom dengan tanda bintang wajib diisi.
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        <Button
                          className="bg-blue-500 text-white hover:bg-blue-600"
                          onClick={handleAssessmentSave}
                          disabled={isAssessmentLocked || isSaving || isUploadingEvidence}
                        >
                          Simpan Perubahan
                        </Button>
                      </div>
                    </div>
                  </FormSection>
                </>
              ) : (
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
            setSearchText('');
          }}
          leadingControls={
            !hideScopeFilter ? (
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
