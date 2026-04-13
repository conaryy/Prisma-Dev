import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ApiError, getAuthUser } from '@/lib/api';
import { downloadFromSignedUrl } from '@/lib/download';
import { resolveTime } from '@/lib/monitoringReview';
import { canManageExternalDnp } from '@/lib/permissions';
import {
  fetchSelfAssessmentCap,
  fetchSelfAssessmentSessions,
  submitSelfAssessmentCapExtension,
  submitSelfAssessmentCapFulfillment,
} from '@/lib/selfAssessment';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

type SelfAssessmentCapFulfillmentHeader = {
  kicker?: string;
  title?: string;
};

interface SelfAssessmentCapFulfillmentProps {
  scope: SelfAssessmentScope;
  sessionAreaId: string;
  header?: SelfAssessmentCapFulfillmentHeader;
  fetchCap?: typeof fetchSelfAssessmentCap;
  submitFulfillment?: typeof submitSelfAssessmentCapFulfillment;
  submitExtensionHandler?: typeof submitSelfAssessmentCapExtension;
  deleteFulfillmentFileHandler?: (fileId: string) => Promise<unknown>;
  syncInit?: () => Promise<{ sessionId: string; captchaUrl: string }>;
  syncRun?: (payload: {
    sessionId: string;
    captcha: string;
    username: string;
    password: string;
    instansiName?: string;
    loginOnly?: boolean;
  }) => Promise<unknown>;
  syncStatus?: (instansiName: string) => Promise<{ active: boolean; instansiName: string }>;
  requireCapReview?: boolean;
  allowSend?: boolean;
  requireFulfillmentFile?: boolean;
  enableQuestionPagination?: boolean;
  questionPageSize?: number;
}

type CapItem = {
  answerId: string;
  questionCode: string;
  questionText: string;
  reference: string | null;
  status: string;
  instansiName?: string | null;
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
    fulfillments: Array<{
      id: string;
      step: number;
      proposeAction: string;
      actionOffice: string;
      evidenceReference: string | null;
      completeDate: string | null;
      progress: number;
      status: string;
      createdAt?: string | null;
      submittedAt: string | null;
      files: Array<{
        id: string;
        name: string;
        url: string;
        source?: 'dnp' | 'local';
        externalFileId?: string | null;
      }>;
    }>;
    extensions: Array<{
      id: string;
      dueDate: string;
      fileName: string;
      fileUrl: string;
      status: string;
    }>;
  } | null;
};

type CapFulfillment = NonNullable<CapItem['cap']>['fulfillments'][number];
const EXTERNAL_DNP_ACTIVE_SESSION_KEY = 'k2s.externalDnp.activeSessionInstansi';
const EXTERNAL_DNP_ACTIVE_SESSION_OLD_KEY = 'k2s.externalDnp.activeSessionCreatedBy';

export function SelfAssessmentCapFulfillment({
  scope,
  sessionAreaId,
  header,
  fetchCap,
  submitFulfillment,
  submitExtensionHandler,
  deleteFulfillmentFileHandler,
  syncInit,
  syncRun,
  syncStatus,
  requireCapReview = true,
  allowSend = true,
  requireFulfillmentFile = false,
  enableQuestionPagination = false,
  questionPageSize = 8,
}: SelfAssessmentCapFulfillmentProps) {
  const authUser = getAuthUser<{ role?: string; permissions?: Record<string, unknown> }>();
  const [items, setItems] = useState<CapItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [questionPage, setQuestionPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isReauthing, setIsReauthing] = useState(false);
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [proposeAction, setProposeAction] = useState('');
  const [actionOffice, setActionOffice] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [completeDate, setCompleteDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [fulfillmentFiles, setFulfillmentFiles] = useState<File[]>([]);
  const fulfillmentFileInputRef = useRef<HTMLInputElement | null>(null);

  const [extensionDueDate, setExtensionDueDate] = useState('');
  const [extensionFile, setExtensionFile] = useState<File | null>(null);
  const [syncSessionId, setSyncSessionId] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [syncUsername, setSyncUsername] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [activeSessionCreatedBy, setActiveSessionCreatedBy] = useState('');
  const [currentInstansiName, setCurrentInstansiName] = useState('');
  const [isSessionActiveForInstansi, setIsSessionActiveForInstansi] = useState(false);
  const [isCheckingSessionStatus, setIsCheckingSessionStatus] = useState(false);
  const [monitoringSessionLabel, setMonitoringSessionLabel] = useState<string>('');
  const [isMonitoringOpenForArea, setIsMonitoringOpenForArea] = useState(false);

  const headerKicker = header?.kicker ?? `${scope} / CAP`;
  const headerTitle = header?.title ?? 'Pemenuhan CAP';

  const requestedAnswerId = searchParams.get('answerId');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved =
      window.localStorage.getItem(EXTERNAL_DNP_ACTIVE_SESSION_KEY) ??
      window.localStorage.getItem(EXTERNAL_DNP_ACTIVE_SESSION_OLD_KEY) ??
      '';
    setActiveSessionCreatedBy(saved);
  }, []);

  const loadItems = useCallback(() => {
    if (!sessionAreaId) {
      setItems([]);
      setActiveId(null);
      return;
    }
    const load = fetchCap ?? fetchSelfAssessmentCap;
    load({ scope, sessionAreaId })
      .then((data) => {
        const normalizedData = data as CapItem[];
        setItems(normalizedData);
        const instansiName = (
          normalizedData.find((item) => (item.instansiName ?? '').trim() !== '')?.instansiName ?? ''
        ).trim();
        setCurrentInstansiName(instansiName);
        setActiveId((prev) => {
          if (requestedAnswerId) {
            const match = normalizedData.find((item) => item.answerId === requestedAnswerId);
            if (match) return match.answerId;
          }
          if (prev && normalizedData.some((item) => item.answerId === prev)) {
            return prev;
          }
          return normalizedData[0]?.answerId ?? null;
        });
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      });
  }, [fetchCap, scope, sessionAreaId, requestedAnswerId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    let cancelled = false;
    fetchSelfAssessmentSessions('monitoring')
      .then((sessions) => {
        if (cancelled) return;
        const matched = (sessions ?? []).find((session) => {
          const targets = session.targetSessionAreaIds ?? [];
          if (targets.length === 0) return true;
          return targets.includes(sessionAreaId);
        });
        if (matched) {
          setIsMonitoringOpenForArea(true);
          setMonitoringSessionLabel(
            matched.title?.trim()
              ? `Monitoring aktif: ${matched.title}`
              : `Monitoring aktif (${matched.startDate} - ${matched.endDate})`
          );
        } else {
          setIsMonitoringOpenForArea(false);
          setMonitoringSessionLabel('Monitoring belum dibuka untuk area ini.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIsMonitoringOpenForArea(false);
        setMonitoringSessionLabel('Status monitoring belum tersedia.');
      });

    return () => {
      cancelled = true;
    };
  }, [sessionAreaId]);

  const filteredItems = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.questionCode} ${item.questionText}`.toLowerCase().includes(term)
    );
  }, [items, searchText]);

  useEffect(() => {
    setQuestionPage(1);
  }, [searchText, items.length]);

  const totalQuestionPages = useMemo(() => {
    if (!enableQuestionPagination) return 1;
    return Math.max(1, Math.ceil(filteredItems.length / questionPageSize));
  }, [enableQuestionPagination, filteredItems.length, questionPageSize]);

  const safeQuestionPage = Math.min(questionPage, totalQuestionPages);

  const pagedItems = useMemo(() => {
    if (!enableQuestionPagination) return filteredItems;
    const start = (safeQuestionPage - 1) * questionPageSize;
    return filteredItems.slice(start, start + questionPageSize);
  }, [enableQuestionPagination, filteredItems, questionPageSize, safeQuestionPage]);

  const activeItem = items.find((item) => item.answerId === activeId) ?? null;
  const activeFiles = useMemo(() => {
    const files = activeItem?.cap?.fulfillments?.flatMap((item) => item.files ?? []) ?? [];
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        url: string;
        source?: 'dnp' | 'local';
        externalFileId?: string | null;
      }
    >();
    files.forEach((file) => map.set(file.id, file));
    return Array.from(map.values());
  }, [activeItem]);
  const activeLocalFiles = useMemo(
    () => activeFiles.filter((file) => (file.source ?? 'local') !== 'dnp'),
    [activeFiles]
  );
  const activeDnpFiles = useMemo(
    () => activeFiles.filter((file) => file.source === 'dnp'),
    [activeFiles]
  );
  const hasCapReviewAvailable = (item: CapItem | null) => {
    const review = item?.cap?.review;
    if (!review) return false;
    return Boolean(
      review.reviewedAt ||
      (review.result ?? '').trim() ||
      (review.comment ?? '').trim() ||
      (review.status ?? '').trim()
    );
  };

  const canFulfill = requireCapReview ? hasCapReviewAvailable(activeItem) : true;
  const shouldShowReviewWarning = requireCapReview && !canFulfill;
  const isExternalDnpMode = !allowSend;
  const isReadOnlyExternalDnp = isExternalDnpMode && !canManageExternalDnp(authUser);

  const resolveProgressValue = (item: CapItem) => {
    const latest = item.cap?.fulfillments?.reduce((current, candidate) => {
      if (!current) return candidate;
      const currentTime = Math.max(
        resolveTime(current.submittedAt),
        resolveTime(current.createdAt)
      );
      const candidateTime = Math.max(
        resolveTime(candidate.submittedAt),
        resolveTime(candidate.createdAt)
      );
      return candidateTime >= currentTime ? candidate : current;
    }, null as CapFulfillment | null);

    return latest?.progress ?? null;
  };

  useEffect(() => {
    const latest = activeItem?.cap?.fulfillments
      ?.slice()
      .sort((a, b) => {
        const aTime = Math.max(resolveTime(a.submittedAt), resolveTime(a.createdAt));
        const bTime = Math.max(resolveTime(b.submittedAt), resolveTime(b.createdAt));
        return aTime - bTime;
      })
      .pop();

    if (latest) {
      const baseStep = Number.isFinite(latest.step) && latest.step > 0 ? latest.step : 1;
      const resolvedStep = latest.status === 'sent' ? baseStep + 1 : baseStep;
      setStep(resolvedStep);
      setProposeAction(latest.proposeAction);
      setActionOffice(latest.actionOffice);
      setEvidenceReference(latest.evidenceReference ?? '');
      setCompleteDate(latest.completeDate ?? '');
      setProgress(latest.progress ?? 0);
    } else {
      setStep(1);
      setProposeAction('');
      setActionOffice('');
      setEvidenceReference('');
      setCompleteDate('');
      setProgress(0);
    }

    setFulfillmentFiles([]);
    if (fulfillmentFileInputRef.current) {
      fulfillmentFileInputRef.current.value = '';
    }
    setExtensionDueDate('');
    setExtensionFile(null);
  }, [activeId, activeItem]);

  const submitFulfillmentForm = (action: 'draft' | 'send', exportToExternal = false) => {
    if (!activeItem?.cap || isReadOnlyExternalDnp) return;
    if (requireCapReview && !canFulfill) {
      toast({
        title: 'Review CAP belum tersedia',
        description: 'Pemenuhan CAP hanya bisa diisi setelah review CAP dikirim.',
      });
      return;
    }
    if (!proposeAction.trim() || !actionOffice.trim() || !completeDate) {
      toast({
        title: 'Data belum lengkap',
        description: 'Propose action, action office, dan complete date wajib diisi.',
      });
      return;
    }
    if (exportToExternal && fulfillmentFiles.length === 0) {
      toast({
        title: 'File wajib diunggah',
        description: 'Upload file wajib diisi sebelum Export DNP.',
      });
      return;
    }
    if (exportToExternal && !isSessionActiveForInstansi) {
      toast({
        title: 'Sesi instansi belum aktif',
        description: 'Silakan login dulu untuk instansi yang sedang dibuka sebelum Export DNP.',
      });
      if (!captchaUrl && syncInit) {
        openSyncChallenge();
      }
      return;
    }
    setIsSaving(true);
    const submit = submitFulfillment ?? submitSelfAssessmentCapFulfillment;
    submit({
      capId: activeItem.cap.id,
      step,
      proposeAction,
      actionOffice,
      evidenceReference: evidenceReference.trim() ? evidenceReference : undefined,
      completeDate,
      progress,
      action,
      exportToExternal,
      file: fulfillmentFiles[0] ?? undefined,
      files: fulfillmentFiles,
    })
      .then(() => {
        const successTitle = exportToExternal
          ? 'Export DNP berhasil'
          : action === 'send'
          ? 'Pemenuhan CAP dikirim'
          : isExternalDnpMode
          ? 'Draft lokal tersimpan'
          : 'Draft tersimpan';
        const successDescription = exportToExternal
          ? 'Data berhasil dikirim ke external DNP.'
          : action === 'send'
          ? 'Pemenuhan CAP berhasil dikirim.'
          : isExternalDnpMode
          ? 'Data disimpan lokal dan belum dikirim ke external.'
          : 'Data disimpan sebagai draft.';
        toast({
          title: successTitle,
          description: successDescription,
        });
        setFulfillmentFiles([]);
        if (fulfillmentFileInputRef.current) {
          fulfillmentFileInputRef.current.value = '';
        }
        loadItems();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
        toast({
          title: exportToExternal
            ? 'Gagal export DNP'
            : action === 'send'
            ? 'Gagal mengirim pemenuhan CAP'
            : isExternalDnpMode
            ? 'Gagal menyimpan draft lokal'
            : 'Gagal menyimpan draft',
          description: message,
        });
        const shouldShowSessionForm =
          error instanceof ApiError &&
          Boolean((error.data as { needSyncUpdateData?: boolean } | null)?.needSyncUpdateData);
        if (shouldShowSessionForm && syncInit && syncRun) {
          openSyncChallenge();
        }
      })
      .finally(() => setIsSaving(false));
  };

  const submitExtension = () => {
    if (!activeItem?.cap || isReadOnlyExternalDnp) return;
    if (requireCapReview && !canFulfill) {
      toast({
        title: 'Review CAP belum tersedia',
        description: 'Permohonan perpanjangan hanya bisa setelah review CAP dikirim.',
      });
      return;
    }
    if (!extensionDueDate || !extensionFile) {
      toast({
        title: 'Data belum lengkap',
        description: 'Due date dan file permohonan wajib diisi.',
      });
      return;
    }
    setIsSubmittingExtension(true);
    const submit = submitExtensionHandler ?? submitSelfAssessmentCapExtension;
    submit({
      capId: activeItem.cap.id,
      dueDate: extensionDueDate,
      file: extensionFile,
    })
      .then(() => {
        toast({
          title: 'Permohonan perpanjangan terkirim',
          description: 'Permohonan perpanjangan CAP berhasil dikirim.',
        });
        loadItems();
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal mengirim permohonan',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSubmittingExtension(false));
  };

  const removeFulfillmentFile = async (fileId: string) => {
    if (!deleteFulfillmentFileHandler) return;
    setDeletingFileId(fileId);
    try {
      await deleteFulfillmentFileHandler(fileId);
      toast({
        title: 'File dihapus',
        description: 'File draft berhasil dihapus.',
      });
      await loadItems();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
      toast({
        title: 'Gagal menghapus file',
        description: message,
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  const openSyncChallenge = useCallback(async () => {
    if (!syncInit || isReadOnlyExternalDnp) return;
    setIsReauthing(true);
    try {
      const init = await syncInit();
      setSyncSessionId(init.sessionId);
      setCaptchaUrl(init.captchaUrl);
      setCaptchaValue('');
      setSyncUsername('');
      setSyncPassword('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
      toast({
        title: 'Gagal memuat captcha',
        description: message,
      });
    } finally {
      setIsReauthing(false);
    }
  }, [isReadOnlyExternalDnp, syncInit]);

  const handleReauth = async () => {
    if (isReadOnlyExternalDnp || !syncRun || !syncSessionId || !syncUsername || !syncPassword || !captchaValue) {
      return;
    }
    setIsReauthing(true);
    try {
      await syncRun({
        sessionId: syncSessionId,
        captcha: captchaValue,
        username: syncUsername,
        password: syncPassword,
        instansiName: currentInstansiName || undefined,
        loginOnly: !allowSend,
      });
      toast({
        title: 'Session diperbarui',
        description: 'Sesi login external berhasil diperbarui.',
      });
      setIsSessionActiveForInstansi(true);
      if (currentInstansiName) {
        setActiveSessionCreatedBy(currentInstansiName);
      }
      setSyncSessionId('');
      setCaptchaUrl('');
      setCaptchaValue('');
      setSyncUsername('');
      setSyncPassword('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
      toast({
        title: 'Gagal memperbarui session',
        description: message,
      });
      setSyncSessionId('');
      setCaptchaUrl('');
      setCaptchaValue('');
      setSyncUsername('');
      setSyncPassword('');
    } finally {
      setIsReauthing(false);
    }
  };

  useEffect(() => {
    if (allowSend || isReadOnlyExternalDnp) return;
    if (!syncStatus) return;
    if (!currentInstansiName) {
      setIsSessionActiveForInstansi(false);
      return;
    }

    let cancelled = false;
    setIsCheckingSessionStatus(true);
    syncStatus(currentInstansiName)
      .then((result) => {
        if (cancelled) return;
        const active = Boolean(result?.active);
        setIsSessionActiveForInstansi(active);
        if (active) {
          setActiveSessionCreatedBy(result.instansiName || currentInstansiName);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIsSessionActiveForInstansi(false);
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingSessionStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [allowSend, currentInstansiName, isReadOnlyExternalDnp, syncStatus]);

  useEffect(() => {
    if (allowSend || isReadOnlyExternalDnp) return;
    if (isSessionActiveForInstansi) return;
    if (!currentInstansiName) return;
    if (!syncInit) return;
    if (captchaUrl) return;
    openSyncChallenge();
  }, [
    allowSend,
    captchaUrl,
    currentInstansiName,
    isReadOnlyExternalDnp,
    isSessionActiveForInstansi,
    openSyncChallenge,
    syncInit,
  ]);

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
                {headerKicker}
              </p>
              <h1 className="text-lg font-semibold text-slate-800">{headerTitle}</h1>
            </div>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">DAFTAR PROTOCOL QUESTION</h2>
              <div className="text-xs text-slate-500">
                {filteredItems.length} pertanyaan
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="max-w-xs"
                placeholder="Cari pertanyaan..."
              />
            </div>
            <div className="overflow-hidden divide-y rounded-xl border border-slate-200">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">
                  Tidak ada pertanyaan Not Satisfactory.
                </div>
              ) : (
                pagedItems.map((item) => {
                  const hasSent = Boolean(
                    item.cap?.fulfillments?.some((fulfillment) => fulfillment.status === 'sent')
                  );
                  const hasDraft = Boolean(
                    item.cap?.fulfillments?.some((fulfillment) => fulfillment.status === 'draft')
                  );
                  const progressValue = resolveProgressValue(item);
                  const rowClass =
                    hasSent
                      ? 'bg-[#e9f7f1] text-slate-900 hover:bg-amber-300 dark:bg-emerald-900/30 dark:text-slate-100 dark:hover:bg-amber-500/60'
                      : hasDraft
                      ? 'bg-[#fff9e8] text-slate-900 hover:bg-amber-300 dark:bg-amber-900/20 dark:text-slate-100 dark:hover:bg-amber-500/60'
                      : activeId === item.answerId
                      ? 'bg-blue-100 text-slate-900 hover:bg-amber-300 dark:bg-blue-900/40 dark:text-slate-100 dark:hover:bg-amber-500/60'
                      : 'text-slate-700 hover:bg-amber-300 dark:text-slate-200 dark:hover:bg-amber-500/60';
                  return (
                  <button
                    key={item.answerId}
                    type="button"
                      className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition ${rowClass}`}
                    onClick={() => setActiveId(item.answerId)}
                  >
                    <span className="mt-1 text-xs font-semibold text-slate-500">
                      {item.questionCode}
                    </span>
                    <span className="flex-1">{item.questionText}</span>
                    {progressValue !== null && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-[#1e3a8a]">
                        {progressValue}%
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        hasSent
                          ? 'bg-emerald-100 text-[#065f46]'
                          : hasDraft
                          ? 'bg-amber-100 text-[#92400e]'
                          : 'bg-slate-100 text-[#475569]'
                      }`}
                    >
                      {hasSent ? 'Dikirim' : hasDraft ? 'Draft' : 'Baru'}
                    </span>
                  </button>
                  );
                })
              )}
            </div>
            {enableQuestionPagination && filteredItems.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-xs text-slate-500">
                  Menampilkan {(safeQuestionPage - 1) * questionPageSize + 1} -{' '}
                  {Math.min(safeQuestionPage * questionPageSize, filteredItems.length)} dari total{' '}
                  {filteredItems.length} pertanyaan
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuestionPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeQuestionPage <= 1}
                  >
                    Sebelumnya
                  </Button>
                  {Array.from({ length: totalQuestionPages }, (_, index) => index + 1).map((page) => (
                    <Button
                      key={page}
                      type="button"
                      size="sm"
                      variant={page === safeQuestionPage ? 'default' : 'outline'}
                      className="h-8 min-w-8 px-2"
                      onClick={() => setQuestionPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuestionPage((prev) => Math.min(totalQuestionPages, prev + 1))
                    }
                    disabled={safeQuestionPage >= totalQuestionPages}
                  >
                    Selanjutnya
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Hasil Review Self Assessment</div>
              {activeItem ? (
                <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <div className="text-xs font-semibold text-slate-500">Protocol Question</div>
                    <div>{activeItem.questionText}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Severity</div>
                    <div>{activeItem.review?.severity ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Probability</div>
                    <div>{activeItem.review?.probability ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Finding</div>
                    <div>{activeItem.review?.finding ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Recommendations</div>
                    <div>{activeItem.review?.recommendations ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Resume</div>
                    <div>{activeItem.review?.resume ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reviewed By</div>
                    <div>{activeItem.review?.reviewedBy?.name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reviewed At</div>
                    <div>{activeItem.review?.reviewedAt ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Status of Implementation</div>
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-[#991b1b]">
                      {activeItem.review?.status ?? 'Not Satisfactory'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Pilih pertanyaan.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Hasil Review CAP</div>
              {activeItem?.cap?.review ? (
                <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Result</div>
                    <div>{activeItem.cap.review.result ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Comment</div>
                    <div>{activeItem.cap.review.comment ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Status</div>
                    <div>{activeItem.cap.review.status ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reviewed By</div>
                    <div>{activeItem.cap.review.reviewedBy?.name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reviewed At</div>
                    <div>{activeItem.cap.review.reviewedAt ?? '-'}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  Review CAP belum tersedia.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Hasil Review Pemenuhan CAP</div>
              {activeItem?.cap?.fulfillmentReview ? (
                <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Result</div>
                    <div>{activeItem.cap.fulfillmentReview.result ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Comment</div>
                    <div>{activeItem.cap.fulfillmentReview.comment ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Status</div>
                    <div>{activeItem.cap.fulfillmentReview.status ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reviewed By</div>
                    <div>{activeItem.cap.fulfillmentReview.reviewedBy?.name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Reviewed At</div>
                    <div>{activeItem.cap.fulfillmentReview.reviewedAt ?? '-'}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  Hasil review pemenuhan CAP belum tersedia.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Pemenuhan CAP</div>
              {activeItem?.cap ? (
                <div className="mt-4 space-y-3">
                  {isReadOnlyExternalDnp && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Mode lihat saja. User non-admin hanya bisa melihat pemenuhan CAP External DNP sesuai instansi yang diberikan admin.
                    </div>
                  )}
                  {shouldShowReviewWarning && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                      Review CAP belum tersedia. Pemenuhan CAP baru bisa diisi setelah review CAP.
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Step *</label>
                      <Input
                        type="number"
                        min={1}
                        value={step}
                        disabled={isReadOnlyExternalDnp}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          setStep(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Complete Date *</label>
                      <Input
                        type="date"
                        value={completeDate}
                        disabled={isReadOnlyExternalDnp}
                        onChange={(event) => setCompleteDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Propose Action *</label>
                    <Textarea
                      rows={3}
                      value={proposeAction}
                      disabled={!canFulfill || isReadOnlyExternalDnp}
                      onChange={(event) => setProposeAction(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Action Office *</label>
                    <Textarea
                      rows={2}
                      value={actionOffice}
                      disabled={!canFulfill || isReadOnlyExternalDnp}
                      onChange={(event) => setActionOffice(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Evidence Reference</label>
                    <Textarea
                      rows={2}
                      value={evidenceReference}
                      disabled={!canFulfill || isReadOnlyExternalDnp}
                      onChange={(event) => setEvidenceReference(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                  <label className="text-xs font-semibold text-slate-600">Progress *</label>
                      <select
                        className="h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        value={progress}
                        disabled={!canFulfill || isReadOnlyExternalDnp}
                        onChange={(event) => setProgress(Number(event.target.value))}
                      >
                        {[0, 25, 50, 75, 100].map((value) => (
                          <option key={value} value={value}>
                            {value}%
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Upload File {requireFulfillmentFile ? '*' : ''}
                      </label>
                      <Input
                        ref={fulfillmentFileInputRef}
                        type="file"
                        multiple
                        onChange={(event) => {
                          const nextFiles = Array.from(event.target.files ?? []);
                          if (nextFiles.length === 0) return;
                          setFulfillmentFiles((prev) => {
                            const map = new Map<string, File>();
                            prev.forEach((file) =>
                              map.set(`${file.name}:${file.size}:${file.lastModified}`, file)
                            );
                            nextFiles.forEach((file) =>
                              map.set(`${file.name}:${file.size}:${file.lastModified}`, file)
                            );
                            return Array.from(map.values());
                          });
                          event.target.value = '';
                        }}
                        disabled={!canFulfill || isReadOnlyExternalDnp}
                      />
                    </div>
                  </div>
                  {fulfillmentFiles.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-xs font-semibold text-slate-600">File dipilih</div>
                      <div className="mt-2 space-y-1">
                        {fulfillmentFiles.map((file) => {
                          const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
                          return (
                            <div key={fileKey} className="flex min-w-0 items-center justify-between gap-2">
                              <div className="min-w-0 flex-1 truncate text-xs text-slate-600">
                                {file.name}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-xs text-slate-600"
                                onClick={() =>
                                  setFulfillmentFiles((prev) =>
                                    prev.filter(
                                      (item) =>
                                        `${item.name}:${item.size}:${item.lastModified}` !== fileKey
                                    )
                                  )
                                }
                                disabled={isSaving || isReadOnlyExternalDnp}
                              >
                                Hapus
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {isExternalDnpMode && activeDnpFiles.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-xs font-semibold text-slate-600">File DNP (read-only)</div>
                      <div className="mt-2 space-y-1">
                        {activeDnpFiles.map((file) => (
                          <div key={file.id} className="flex min-w-0 items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {isSessionActiveForInstansi ? (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={file.name}
                                  className="block truncate text-xs text-blue-600 hover:underline"
                                >
                                  {file.name}
                                </a>
                              ) : (
                                <span
                                  title={
                                    isReadOnlyExternalDnp
                                      ? `${file.name} (akses file DNP membutuhkan sesi admin aktif)`
                                      : `${file.name} (login instansi diperlukan)`
                                  }
                                  className="block truncate text-xs text-slate-500"
                                >
                                  {file.name}
                                </span>
                              )}
                            </div>
                            {!isSessionActiveForInstansi && (
                              <span className="shrink-0 text-[10px] font-semibold text-amber-700">
                                {isReadOnlyExternalDnp ? 'Sesi admin diperlukan' : 'Login instansi dulu'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeLocalFiles.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-xs font-semibold text-slate-600">
                        {isExternalDnpMode ? 'File Lokal (untuk Export DNP)' : 'File Evidence'}
                      </div>
                      <div className="mt-2 space-y-1">
                        {activeLocalFiles.map((file) => (
                          <div key={file.id} className="flex min-w-0 items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <a
                                href={file.url}
                                title={file.name}
                                className="block truncate text-xs text-blue-600 hover:underline"
                                onClick={(event) => {
                                  event.preventDefault();
                                  void downloadFromSignedUrl(file.url, file.name).catch((error) => {
                                    toast({
                                      title: 'Gagal mengunduh file.',
                                      description:
                                        error instanceof Error ? error.message : undefined,
                                      variant: 'destructive',
                                    });
                                  });
                                }}
                              >
                                {file.name}
                              </a>
                            </div>
                            {deleteFulfillmentFileHandler && !isReadOnlyExternalDnp && (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-7 shrink-0 px-2 text-xs text-red-600 hover:text-red-700"
                                onClick={() => removeFulfillmentFile(file.id)}
                                disabled={deletingFileId === file.id || isSaving}
                              >
                                Hapus
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!isReadOnlyExternalDnp && (
                    <>
                      <div className="text-xs text-red-500">Kolom dengan tanda bintang wajib diisi.</div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => submitFulfillmentForm('draft', false)}
                          disabled={!canFulfill || isSaving}
                        >
                          {allowSend ? 'Draft' : 'Simpan Draft (Lokal)'}
                        </Button>
                        {!allowSend && (
                          <Button
                            className="bg-blue-500 text-white hover:bg-blue-600"
                            onClick={() => submitFulfillmentForm('draft', true)}
                            disabled={!canFulfill || isSaving || !isSessionActiveForInstansi}
                          >
                            Export DNP
                          </Button>
                        )}
                        {allowSend && (
                          <Button
                            className="bg-blue-500 text-white hover:bg-blue-600"
                            onClick={() => submitFulfillmentForm('send')}
                            disabled={!canFulfill || isSaving}
                          >
                            Submit
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                  <div className="flex justify-end">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                        isMonitoringOpenForArea
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isMonitoringOpenForArea ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                      />
                      {monitoringSessionLabel || 'Status monitoring belum tersedia.'}
                    </div>
                  </div>
                  {!allowSend && !isReadOnlyExternalDnp && (
                    <div className="flex justify-end">
                      {isSessionActiveForInstansi && activeSessionCreatedBy ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Sesi aktif: {activeSessionCreatedBy}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          {currentInstansiName
                            ? `Sesi tidak aktif: ${currentInstansiName}`
                            : 'Sesi tidak aktif'}
                        </div>
                      )}
                    </div>
                  )}
                  {!allowSend && !isReadOnlyExternalDnp && !isSessionActiveForInstansi && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-700">
                          Login instansi diperlukan sebelum Export DNP.
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          onClick={openSyncChallenge}
                          disabled={isReauthing}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          {captchaUrl ? 'Ganti Captcha' : 'Ambil Captcha'}
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Input
                          value={syncUsername}
                          onChange={(event) => setSyncUsername(event.target.value)}
                          className="h-9 w-40"
                          placeholder="Username DNP"
                          autoComplete="username"
                        />
                        <Input
                          type="password"
                          value={syncPassword}
                          onChange={(event) => setSyncPassword(event.target.value)}
                          className="h-9 w-40"
                          placeholder="Password DNP"
                          autoComplete="current-password"
                        />
                        {captchaUrl ? (
                          <img
                            src={captchaUrl}
                            alt="Captcha"
                            className="h-9 rounded border border-slate-200"
                          />
                        ) : (
                          <div className="inline-flex h-9 items-center rounded border border-dashed border-slate-300 px-2 text-xs text-slate-500">
                            {isCheckingSessionStatus ? 'Cek sesi...' : 'Captcha belum tersedia'}
                          </div>
                        )}
                        <Input
                          value={captchaValue}
                          onChange={(event) => setCaptchaValue(event.target.value)}
                          className="h-9 w-28"
                          placeholder="Captcha"
                        />
                        <Button
                          type="button"
                          className="h-9 bg-blue-500 text-white hover:bg-blue-600"
                          onClick={handleReauth}
                          disabled={
                            isReauthing ||
                            !syncSessionId ||
                            !syncUsername ||
                            !syncPassword ||
                            !captchaValue
                          }
                        >
                          {isReauthing ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Proses
                            </>
                          ) : (
                            'Login'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  CAP belum tersedia untuk pertanyaan ini.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Permohonan Perpanjangan</div>
              {activeItem?.cap ? (
                <div className="mt-4 space-y-3">
                  {isReadOnlyExternalDnp && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      Mode lihat saja. User non-admin tidak bisa mengirim perpanjangan CAP External DNP.
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Due Date *</label>
                      <Input
                        type="date"
                        value={extensionDueDate}
                        disabled={!canFulfill || isReadOnlyExternalDnp}
                        onChange={(event) => setExtensionDueDate(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">File Permohonan *</label>
                      <Input
                        type="file"
                        onChange={(event) =>
                          setExtensionFile(event.target.files?.[0] ?? null)
                        }
                        disabled={!canFulfill || isReadOnlyExternalDnp}
                      />
                    </div>
                  </div>
                  {!isReadOnlyExternalDnp && (
                    <div className="flex justify-end">
                      <Button
                        className="bg-blue-500 text-white hover:bg-blue-600"
                        onClick={submitExtension}
                        disabled={!canFulfill || isSubmittingExtension}
                      >
                        Submit
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">
                  CAP belum tersedia untuk pertanyaan ini.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
