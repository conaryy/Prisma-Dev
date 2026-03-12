import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ClipboardCheck } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { apiFetch, resolveApiUrl } from '@/lib/api';
import {
  fetchAdminSelfAssessmentCapFulfillmentDetail,
  submitAdminSelfAssessmentCapFulfillmentReview,
} from '@/lib/selfAssessment';

type CapDetail = {
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
    actionPlan: string | null;
    targetDate: string | null;
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
  }>;
};

export function SelfAssessmentCapFulfillmentDetail() {
  const { sessionAreaId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CapDetail | null>(null);
  const [activeCapId, setActiveCapId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'Satisfactory' | 'Not Satisfactory'>(
    'Not Satisfactory'
  );
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [monitoringTitle, setMonitoringTitle] = useState('');
  const [monitoringStartDate, setMonitoringStartDate] = useState('');
  const [monitoringEndDate, setMonitoringEndDate] = useState('');
  const [monitoringFile, setMonitoringFile] = useState<File | null>(null);
  const [isOpeningMonitoring, setIsOpeningMonitoring] = useState(false);
  const [isDeletingMonitoringSession, setIsDeletingMonitoringSession] = useState(false);
  const [isLoadingMonitoringState, setIsLoadingMonitoringState] = useState(false);
  const [monitoringStateText, setMonitoringStateText] = useState<string | null>(null);
  const [forceOpenMonitoring, setForceOpenMonitoring] = useState(false);
  const [matchedMonitoringSessions, setMatchedMonitoringSessions] = useState<
    Array<{ id: string; title: string | null; startDate: string; endDate: string }>
  >([]);

  const userId = searchParams.get('userId') ?? '';
  const isMonitoringReviewPage = location.pathname.startsWith('/admin/monitoring-reviews');
  const backPath = isMonitoringReviewPage
    ? '/admin/monitoring-reviews'
    : '/admin/self-assessment-cap-fulfillments';
  const pageGroupLabel = isMonitoringReviewPage ? 'Admin / Monitoring' : 'Admin / CAP';
  const pageTitle = isMonitoringReviewPage
    ? 'Review Monitoring Self Assessment'
    : 'Hasil Pemenuhan CAP';
  const formatMonitoringDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const activeItem = useMemo(
    () => detail?.caps.find((item) => item.id === activeCapId) ?? null,
    [detail, activeCapId]
  );
  const hasOpenedMonitoringSession = matchedMonitoringSessions.length > 0;

  const resolveQuestionProgress = (item: CapDetail['caps'][number]) => {
    const fulfillments = item.fulfillments ?? [];
    if (fulfillments.length === 0) return 0;
    return Math.max(...fulfillments.map((entry) => entry.progress ?? 0));
  };

  const isQuestionReviewed = (item: CapDetail['caps'][number]) =>
    Boolean(item.fulfillmentReview?.reviewedAt);

  const resolveQuestionVisualState = (item: CapDetail['caps'][number]) => {
    const progress = resolveQuestionProgress(item);
    if (progress < 100) return 'pending';
    return isQuestionReviewed(item) ? 'reviewed' : 'unreviewed';
  };

  const resolveQuestionProgressBadgeClass = (item: CapDetail['caps'][number]) => {
    const state = resolveQuestionVisualState(item);
    if (state === 'pending') return 'bg-slate-300 text-slate-900';
    if (state === 'unreviewed') return 'bg-[#efe3ad] text-[#5f4a00]';
    return 'bg-[#b8f0dc] text-[#0f5a49]';
  };

  const resolveQuestionRowClass = (item: CapDetail['caps'][number], isActive: boolean) => {
    const state = resolveQuestionVisualState(item);
    if (state === 'unreviewed') {
      return isActive
        ? 'bg-amber-100 text-slate-900 dark:bg-[#3a3324] dark:text-slate-100'
        : 'bg-amber-50 text-slate-900 hover:bg-amber-300 dark:bg-[#342f23] dark:text-slate-100 dark:hover:bg-amber-500/60';
    }
    if (state === 'reviewed') {
      return isActive
        ? 'bg-emerald-100 text-slate-900 dark:bg-[#0f3f46] dark:text-slate-100'
        : 'bg-emerald-50 text-slate-900 hover:bg-amber-300 dark:bg-[#0d3a40] dark:text-slate-100 dark:hover:bg-amber-500/60';
    }
    return isActive
      ? 'bg-blue-100 text-slate-900 dark:bg-blue-900/40 dark:text-slate-100'
      : 'text-slate-700 hover:bg-amber-300 dark:text-slate-200 dark:hover:bg-amber-500/60';
  };

  const resolveQuestionCodeClass = (item: CapDetail['caps'][number]) => {
    const state = resolveQuestionVisualState(item);
    if (state === 'pending') return 'text-slate-500 dark:text-slate-300';
    return 'text-slate-700 dark:text-slate-200';
  };

  const resolveStatusBadgeClass = (status?: string | null) => {
    const normalized = (status ?? '').trim().toLowerCase();
    if (normalized === 'satisfactory') return 'bg-[#b8f0dc] text-[#0f5a49]';
    if (normalized === 'not satisfactory') return 'bg-rose-100 text-slate-900';
    if (normalized === 'not applicable') return 'bg-violet-100 text-slate-900';
    return 'bg-slate-200 text-slate-900';
  };

  const highestProgress = useMemo(() => {
    const fulfillments = activeItem?.fulfillments ?? [];
    if (fulfillments.length === 0) return 0;
    return Math.max(...fulfillments.map((item) => item.progress ?? 0));
  }, [activeItem]);

  const canReviewFulfillment = highestProgress >= 100;
  const isAllCapSubmittedByUser = useMemo(() => {
    if (!detail) return false;
    const totalCaps = detail.totalCaps ?? detail.caps.length;
    if (totalCaps <= 0) return false;
    const sentCaps = detail.sentCaps ?? 0;
    return sentCaps >= totalCaps;
  }, [detail]);
  const canOpenMonitoringSession = isAllCapSubmittedByUser || forceOpenMonitoring;
  const orderedFulfillments = useMemo(() => {
    const fulfillments = activeItem?.fulfillments ?? [];
    return fulfillments
      .slice()
      .sort((a, b) => {
        const aTime = a.submittedAt
          ? new Date(a.submittedAt).getTime()
          : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
        const bTime = b.submittedAt
          ? new Date(b.submittedAt).getTime()
          : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
        if (aTime === bTime) return a.step - b.step;
        return aTime - bTime;
      });
  }, [activeItem]);

  useEffect(() => {
    if (!activeItem || highestProgress < 100) {
      setReviewComment('');
      setReviewStatus('Not Satisfactory');
      return;
    }
    setReviewComment(activeItem.fulfillmentReview?.comment ?? '');
    const nextStatusRaw =
      activeItem.fulfillmentReview?.status ??
      activeItem.fulfillmentReview?.result ??
      'Not Satisfactory';
    const normalized = nextStatusRaw.toLowerCase() === 'satisfactory'
      ? 'Satisfactory'
      : 'Not Satisfactory';
    setReviewStatus(normalized);
  }, [activeItem, highestProgress]);

  const loadMonitoringState = useCallback(() => {
    if (!sessionAreaId || !userId) {
      setMatchedMonitoringSessions([]);
      setMonitoringStateText(null);
      return;
    }
    setIsLoadingMonitoringState(true);
    apiFetch<{
      data: Array<{
        id: string;
        title: string | null;
        start_date: string;
        end_date: string;
        target_session_area_ids?: string[] | null;
        users?: Array<{ id: string; name: string; email?: string }>;
      }>;
    }>('/api/admin/self-assessment/sessions?scope=monitoring')
      .then((response) => {
        const list = response.data ?? [];
        const matched = list.filter((session) => {
          const targets = session.target_session_area_ids ?? [];
          const hasTarget =
            targets.length === 0 || targets.includes(sessionAreaId);
          if (!hasTarget) return false;
          const assignedUserIds = (session.users ?? []).map((item) => item.id);
          if (assignedUserIds.length === 0) return true;
          return assignedUserIds.includes(userId);
        });
        const normalizedMatched = matched
          .map((session) => ({
            id: session.id,
            title: session.title,
            startDate: session.start_date,
            endDate: session.end_date,
          }))
          .sort(
            (a, b) =>
              new Date(b.startDate ?? '1970-01-01').getTime() -
              new Date(a.startDate ?? '1970-01-01').getTime()
          );
        setMatchedMonitoringSessions(normalizedMatched);
        if (matched.length === 0) {
          setMonitoringStateText('Sesi monitoring belum dibuka untuk user dan area ini.');
          return;
        }
        const latest = normalizedMatched[0];
        setMonitoringStateText(
          `Sesi aktif: ${latest.title || 'Monitoring'} (${formatMonitoringDate(latest.startDate)} - ${formatMonitoringDate(latest.endDate)})`
        );
      })
      .catch(() => {
        setMatchedMonitoringSessions([]);
        setMonitoringStateText('Status sesi monitoring tidak dapat dimuat.');
      })
      .finally(() => setIsLoadingMonitoringState(false));
  }, [sessionAreaId, userId]);

  const handleDeleteMonitoringSession = async () => {
    const latestSession = matchedMonitoringSessions[0];
    if (!latestSession) return;
    if (!window.confirm('Hapus sesi monitoring aktif untuk area ini?')) return;

    setIsDeletingMonitoringSession(true);
    try {
      await apiFetch(`/api/admin/self-assessment/sessions/${latestSession.id}`, {
        method: 'DELETE',
      });
      toast({
        title: 'Sesi monitoring dihapus',
        description: 'Sesi monitoring berhasil dibatalkan.',
      });
      loadMonitoringState();
    } catch (error) {
      toast({
        title: 'Gagal menghapus sesi monitoring',
        description:
          error instanceof Error && error.message ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsDeletingMonitoringSession(false);
    }
  };

  const loadDetail = useCallback(() => {
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
          title: 'Gagal memuat detail',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  }, [sessionAreaId, userId]);

  useEffect(() => {
    loadDetail();
    loadMonitoringState();
  }, [loadDetail, loadMonitoringState]);

  const handleSubmitReview = async (action: 'draft' | 'send') => {
    if (!activeItem) return;
    if (!canReviewFulfillment) {
      toast({
        title: 'Progress belum 100%',
        description: 'Review pemenuhan CAP hanya dapat dikirim jika progress sudah 100%.',
      });
      return;
    }
    setIsSavingReview(true);
    try {
      await submitAdminSelfAssessmentCapFulfillmentReview({
        capId: activeItem.id,
        status: reviewStatus,
        result: reviewStatus,
        comment: reviewComment.trim() ? reviewComment.trim() : undefined,
        action,
        enforceProgress100: true,
      });
      toast({
        title: action === 'send' ? 'Review pemenuhan CAP dikirim' : 'Draft review tersimpan',
      });
      loadDetail();
    } catch (error) {
      toast({
        title: 'Gagal menyimpan review',
        description:
          error instanceof Error && error.message ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleOpenMonitoringSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionAreaId || !userId) return;
    if (!monitoringStartDate || !monitoringEndDate) {
      toast({
        title: 'Tanggal wajib diisi',
        description: 'Tanggal mulai dan tanggal akhir monitoring harus diisi.',
      });
      return;
    }
    setIsOpeningMonitoring(true);
    try {
      const response = await apiFetch<{ data?: { id?: string } }>(
        '/api/admin/self-assessment/sessions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'monitoring',
            title: monitoringTitle.trim() || null,
            startDate: monitoringStartDate,
            endDate: monitoringEndDate,
            isPublished: true,
            userIds: [userId],
            targetSessionAreaIds: [sessionAreaId],
            targetAgendaIds: [],
          }),
        }
      );

      const monitoringSessionId = response?.data?.id;
      if (monitoringSessionId && monitoringFile) {
        const formData = new FormData();
        formData.append('file', monitoringFile);
        await apiFetch(`/api/admin/self-assessment/sessions/${monitoringSessionId}/file`, {
          method: 'POST',
          body: formData,
        });
      }

      setMonitoringFile(null);
      setMonitoringTitle('');
      setForceOpenMonitoring(false);
      toast({
        title: 'Sesi monitoring dibuka',
        description: 'Monitoring berhasil dipublish dari menu review pemenuhan CAP.',
      });
      loadMonitoringState();
    } catch (error) {
      toast({
        title: 'Gagal membuka sesi monitoring',
        description:
          error instanceof Error && error.message ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsOpeningMonitoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {pageGroupLabel}
              </p>
              <h1 className="text-lg font-semibold text-slate-800">{pageTitle}</h1>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate(backPath)}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
        </header>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  DAFTAR PROTOCOL QUESTION
                </h2>
                {detail?.schedule && (
                  <span className="text-xs font-semibold text-slate-500">
                    {detail.schedule}
                  </span>
                )}
              </div>
              {detail && (
                <div className="text-xs font-semibold text-slate-600">
                  Dikirim {detail.sentCaps ?? detail.caps.length} /{' '}
                  {detail.totalCaps ?? detail.caps.length}
                </div>
              )}
              <div className="overflow-hidden divide-y rounded-xl border border-slate-200">
                {isLoading ? (
                  <div className="px-3 py-4 text-sm text-slate-500">Memuat data...</div>
                ) : !detail || detail.caps.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">
                    Tidak ada pemenuhan CAP yang dikirim.
                  </div>
                ) : (
                detail.caps.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition ${
                        resolveQuestionRowClass(item, activeCapId === item.id)
                      }`}
                    onClick={() => setActiveCapId(item.id)}
                  >
                    <span className={`mt-1 text-xs font-semibold ${resolveQuestionCodeClass(item)}`}>
                      {item.questionCode ?? '-'}
                    </span>
                    <span className="flex-1">{item.questionText || '-'}</span>
                    <span
                      className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-semibold ${resolveQuestionProgressBadgeClass(
                        item
                      )}`}
                    >
                      {resolveQuestionProgress(item)}%
                    </span>
                  </button>
                ))
              )}
            </div>
            </div>

            <form
              onSubmit={handleOpenMonitoringSession}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="text-sm font-semibold text-slate-700">
                Open Sesi Monitoring
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500">Judul (opsional)</label>
                  <Input
                    value={monitoringTitle}
                    onChange={(event) => setMonitoringTitle(event.target.value)}
                    placeholder="Judul kegiatan monitoring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Tanggal Mulai *</label>
                  <Input
                    type="date"
                    value={monitoringStartDate}
                    onChange={(event) => setMonitoringStartDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Tanggal Akhir *</label>
                  <Input
                    type="date"
                    value={monitoringEndDate}
                    onChange={(event) => setMonitoringEndDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500">
                    File Monitoring (opsional)
                  </label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
                    onChange={(event) => setMonitoringFile(event.target.files?.[0] ?? null)}
                  />
                  <div className="text-xs text-slate-500">
                    Sesi monitoring tetap bisa dibuka tanpa upload file. File bisa ditambahkan nanti bila diperlukan.
                  </div>
                  {monitoringFile ? (
                    <div className="text-xs text-slate-500">File dipilih: {monitoringFile.name}</div>
                  ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {isLoadingMonitoringState
                  ? 'Memuat status sesi monitoring...'
                  : monitoringStateText ?? 'Sesi monitoring belum dibuka untuk user dan area ini.'}
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <Checkbox
                  checked={forceOpenMonitoring}
                  onCheckedChange={(checked) => setForceOpenMonitoring(checked === true)}
                />
                <span>Buka sesi monitoring walaupun CAP belum lengkap</span>
              </label>
              {!canOpenMonitoringSession && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Sesi monitoring hanya bisa dibuka setelah user mengirim semua CAP.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  disabled={
                    isOpeningMonitoring ||
                    !sessionAreaId ||
                    !userId ||
                    hasOpenedMonitoringSession ||
                    !canOpenMonitoringSession
                  }
                >
                  {isOpeningMonitoring ? 'Membuka sesi...' : 'Open Sesi Monitoring'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={isDeletingMonitoringSession || matchedMonitoringSessions.length === 0}
                  onClick={handleDeleteMonitoringSession}
                >
                  {isDeletingMonitoringSession
                    ? 'Menghapus sesi...'
                    : 'Batalkan Sesi Monitoring'}
                </Button>
              </div>
              {matchedMonitoringSessions.length > 0 ? (
                <div className="text-xs text-slate-500">
                  Total sesi monitoring aktif untuk area ini: {matchedMonitoringSessions.length}
                </div>
              ) : null}
            </form>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {isLoading ? (
                <div className="text-sm text-slate-500">Memuat data...</div>
              ) : !activeItem ? (
                <div className="text-sm text-slate-500">Pilih pertanyaan CAP.</div>
              ) : (
                <>
                  <div className="text-sm font-semibold text-slate-700">
                    Review Self Assessment Unit Safety
                  </div>
                  <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <div className="text-xs font-semibold text-slate-500">
                        Protocol Question
                      </div>
                      <div>{activeItem.questionText || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Severity</div>
                      <div>{activeItem.selfAssessmentReview?.severity ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Probability</div>
                      <div>{activeItem.selfAssessmentReview?.probability ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Finding</div>
                      <div>{activeItem.selfAssessmentReview?.finding ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        Recommendations
                      </div>
                      <div>{activeItem.selfAssessmentReview?.recommendations ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Resume</div>
                      <div>{activeItem.selfAssessmentReview?.resume ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        Reviewed By
                      </div>
                      <div>{activeItem.selfAssessmentReview?.reviewedBy?.name ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        Reviewed At
                      </div>
                      <div>{activeItem.selfAssessmentReview?.reviewedAt ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        Status of Implementation
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${resolveStatusBadgeClass(
                          activeItem.selfAssessmentReview?.status
                        )}`}
                      >
                        {activeItem.selfAssessmentReview?.status ?? 'Not Satisfactory'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Penyusunan CAP</div>
                {activeItem && sessionAreaId && userId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/admin/self-assessment-cap-reviews/${sessionAreaId}?userId=${userId}&capId=${activeItem.id}`
                      )
                    }
                  >
                    Review CAP
                  </Button>
                )}
              </div>
              {activeItem ? (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Action Plan</div>
                    <div>{activeItem.actionPlan || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Target Date</div>
                    <div>{activeItem.targetDate || '-'}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">CAP belum tersedia.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Pemenuhan CAP</div>
              {activeItem ? (
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  {orderedFulfillments.length === 0 ? (
                    <div className="text-sm text-slate-500">
                      Belum ada pemenuhan yang dikirim.
                    </div>
                  ) : (
                    orderedFulfillments.map((fulfillment, index) => (
                      <div
                        key={fulfillment.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="mb-2 text-xs font-semibold text-slate-500">
                          Step {index + 1}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold text-slate-500">
                              Propose Action
                            </div>
                            <div>{fulfillment.proposeAction}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500">
                              Action Office
                            </div>
                            <div>{fulfillment.actionOffice}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500">
                              Evidence Reference
                            </div>
                            <div>{fulfillment.evidenceReference ?? '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500">
                              Complete Date
                            </div>
                            <div>{fulfillment.completeDate ?? '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500">
                              Progress
                            </div>
                            <div>{fulfillment.progress}%</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500">
                              Submitted At
                            </div>
                            <div>{fulfillment.submittedAt ?? '-'}</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-slate-500">File Evidence</div>
                          {fulfillment.files.length === 0 ? (
                            <div className="text-sm text-slate-500">Tidak ada file.</div>
                          ) : (
                            <Table className="mt-2">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-16 text-center">No</TableHead>
                                  <TableHead>Filename</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {fulfillment.files.map((file, index) => (
                                  <TableRow key={file.id}>
                                    <TableCell className="text-center">{index + 1}</TableCell>
                                    <TableCell>
                                      <a
                                        href={resolveApiUrl(file.url)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 underline"
                                      >
                                        {file.name}
                                      </a>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">CAP belum tersedia.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Review Pemenuhan CAP</div>
              {!activeItem ? (
                <div className="mt-3 text-sm text-slate-500">Pilih pertanyaan CAP.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">CAP Status</div>
                      <div className="mt-1 flex items-center gap-2">
                        <select
                          className="h-9 rounded-lg border border-input bg-white/90 px-3 text-xs font-semibold text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-900/80 dark:text-slate-100"
                          value={reviewStatus}
                          onChange={(event) =>
                            setReviewStatus(
                              event.target.value === 'Satisfactory'
                                ? 'Satisfactory'
                                : 'Not Satisfactory'
                            )
                          }
                        >
                          <option value="Not Satisfactory">Not Satisfactory</option>
                          <option value="Satisfactory">Satisfactory</option>
                        </select>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${resolveStatusBadgeClass(
                            reviewStatus
                          )}`}
                        >
                          {reviewStatus}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Progress Auditor</div>
                      <div className="text-sm font-semibold text-slate-700">{highestProgress}%</div>
                    </div>
                  </div>

                  {!canReviewFulfillment ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Review hanya bisa dikirim jika progress pemenuhan CAP sudah 100%.
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Comment</label>
                    <Textarea
                      rows={4}
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="Masukkan komentar review pemenuhan CAP"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!activeItem || isSavingReview || !canReviewFulfillment}
                      onClick={() => handleSubmitReview('draft')}
                    >
                      Simpan Draft
                    </Button>
                    <Button
                      type="button"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      disabled={!activeItem || isSavingReview || !canReviewFulfillment}
                      onClick={() => handleSubmitReview('send')}
                    >
                      Kirim Review
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">
                Hasil Akhir (Lihat Saja)
              </div>
              {detail?.result ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">
                      Status saat ini: {detail.result.status?.toUpperCase() ?? '-'}
                    </span>
                    <span className="text-slate-500">
                      {detail.result.finalizedAt ?? '-'}
                    </span>
                  </div>
                  {detail.result.files.length === 0 ? (
                    <div className="text-sm text-slate-500">Belum ada file hasil.</div>
                  ) : (
                    <div className="space-y-2">
                      {detail.result.files.map((file) => (
                        <a
                          key={file.id}
                          href={resolveApiUrl(file.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-blue-600 underline"
                        >
                          {file.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  Belum ada hasil akhir yang dikirim.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
