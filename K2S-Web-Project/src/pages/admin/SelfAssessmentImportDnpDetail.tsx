import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  LogIn,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { useAsyncJobPolling } from '@/hooks/useAsyncJobPolling';
import { useDnpSessionAreaFlow } from '@/hooks/useDnpSessionAreaFlow';
import { resolveApiUrl } from '@/lib/api';
import {
  calculateDnpQuestionSimilarity,
  getDnpMatchToneClass,
} from '@/lib/selfAssessmentDnpMatching';
import {
  fetchAdminSelfAssessmentExportDnpImportJob,
  fetchAdminSelfAssessmentImportDnpInjectJob,
  fetchAdminSelfAssessmentSubmissionDetail,
  importAdminSelfAssessmentExportDnp,
  injectAdminSelfAssessmentFromDnp,
  type SelfAssessmentExportDnpCompareItem,
  type SelfAssessmentExportDnpImportJobResponse,
} from '@/lib/selfAssessment';

/* ─── types ─── */
type LocalAnswer = {
  id: string;
  questionCode: string;
  questionText: string;
  status: string;
  comment: string | null;
  evidenceNote: string | null;
};

type MatchPair = {
  answerId: string;
  localCode: string;
  localText: string;
  dnpItem: SelfAssessmentExportDnpCompareItem;
  similarity: number;
  /** true = will be injected */
  selected: boolean;
};

type Step = 'login' | 'area' | 'fetching' | 'compare' | 'done';

const DEFAULT_THRESHOLD = 90;

export function SelfAssessmentImportDnpDetail() {
  const { userId, sessionAreaId } = useParams<{ userId: string; sessionAreaId: string }>();

  /* session meta */
  const [sessionInfo, setSessionInfo] = useState<{
    area: string;
    userName: string;
    schedule: string | null;
    answers: LocalAnswer[];
  } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  /* step */
  const [step, setStep] = useState<Step>('login');

  const {
    sessionId: dnpSessionId,
    setSessionId: setDnpSessionId,
    captchaUrl,
    setCaptchaUrl,
    username,
    setUsername,
    password,
    setPassword,
    captcha,
    setCaptcha,
    year: dnpYear,
    setYear: setDnpYear,
    areas,
    setAreas,
    selectedAreaKey,
    setSelectedAreaKey,
    selectedArea,
    captchaLoading,
    areaLoading,
    initializeSession,
    loadAreas,
  } = useDnpSessionAreaFlow();

  /* fetch progress */
  const [fetchStatus, setFetchStatus] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* compare */
  const [dnpItems, setDnpItems] = useState<SelfAssessmentExportDnpCompareItem[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  /* inject */
  const [injecting, setInjecting] = useState(false);
  const [injectResult, setInjectResult] = useState<{ injectedCount: number; message: string } | null>(null);

  /* load session meta on mount */
  useEffect(() => {
    if (!sessionAreaId || !userId) return;
    setSessionLoading(true);
    fetchAdminSelfAssessmentSubmissionDetail({
      sessionAreaId,
      userId,
      mode: 'importDnp',
    })
      .then((data) => {
        setSessionInfo({
          area: data.area,
          userName: userId, // we only have userId from the URL; name not in detail response
          schedule: data.schedule,
          answers: data.answers.map((a) => ({
            id: a.id,
            questionCode: a.questionCode,
            questionText: a.questionText,
            status: a.status,
            comment: a.comment,
            evidenceNote: a.evidenceNote ?? null,
          })),
        });
      })
      .catch((err: Error) => {
        toast({ title: 'Gagal memuat sesi', description: err.message });
      })
      .finally(() => setSessionLoading(false));
  }, [sessionAreaId, userId]);

  /* ── Step 1: get captcha ── */
  const handleGetCaptcha = async () => {
    setFetchError(null);
    try {
      await initializeSession();
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Gagal memuat captcha.');
    }
  };

  /* ── Step 2: login → get areas ── */
  const handleGetAreas = async () => {
    if (!sessionAreaId) return;
    setFetchError(null);
    try {
      await loadAreas({ sessionAreaId });
      setStep('area');
      toast({ title: 'Login berhasil', description: 'Pilih area DNP lalu ambil data.' });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Login gagal. Coba ulangi captcha.');
    }
  };

  /* ── Step 3: fetch DNP data → polling ── */
  const { startPolling: startImportPolling, stopPolling: stopImportPolling } =
    useAsyncJobPolling<SelfAssessmentExportDnpImportJobResponse>({
      poll: fetchAdminSelfAssessmentExportDnpImportJob,
      isPending: (response) => {
        if (response.status === 'queued' || response.status === 'running') {
          setFetchStatus(response.message ?? 'Mengambil data dari DNP…');
          return true;
        }
        return false;
      },
      onSuccess: (response) => {
        const snapshot = response.summary?.snapshot ?? null;
        if (!snapshot) {
          setFetchError('Snapshot tidak tersedia dari DNP.');
          setStep('area');
          return;
        }

        setDnpItems(snapshot.items);
        setStep('compare');
        toast({
          title: 'Data DNP berhasil diambil',
          description: 'Cocokkan pertanyaan lalu inject.',
        });
      },
      onFailure: (response) => {
        setFetchError(response.error ?? response.message ?? 'Gagal mengambil data DNP.');
        setStep('area');
      },
      onError: () => {
        setFetchError('Gagal memantau job. Coba refresh halaman.');
        setStep('area');
      },
    });

  const handleFetchDnpData = async () => {
    if (!sessionAreaId || !userId) return;
    const area = selectedArea;
    if (!area) {
      setFetchError('Pilih area terlebih dahulu.');
      return;
    }
    setStep('fetching');
    setFetchStatus('Mengirim permintaan ke DNP…');
    setFetchError(null);
    stopImportPolling();
    try {
      const yearNum = Number(dnpYear);
      const resp = await importAdminSelfAssessmentExportDnp({
        sessionAreaId,
        userId,
        sessionId: dnpSessionId,
        username,
        password,
        captcha,
        year: yearNum,
        fillCode1: area.fillCode1,
        fillCode2: area.fillCode2,
        fillArea: area.area,
      });
      if (!resp.jobId) throw new Error('Job tidak tersedia.');
      void startImportPolling(resp.jobId);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Gagal memulai pengambilan data.');
      setStep('area');
    }
  };

  /* ── build pairs whenever dnpItems / sessionInfo / threshold changes ── */
  useEffect(() => {
    if (!sessionInfo || dnpItems.length === 0) {
      setPairs([]);
      return;
    }
    const answers = sessionInfo.answers;
    const usedDnpIds = new Set<string>();
    const nextPairs: MatchPair[] = [];

    // For each local answer, find best DNP match >= threshold
    for (const answer of answers) {
      let best: { item: SelfAssessmentExportDnpCompareItem; sim: number } | null = null;
      for (const item of dnpItems) {
        const sim = calculateDnpQuestionSimilarity(
          answer.questionText,
          item.questionText ?? ''
        );
        if (sim >= threshold && (!best || sim > best.sim)) {
          best = { item, sim };
        }
      }
      if (best && !usedDnpIds.has(best.item.id)) {
        usedDnpIds.add(best.item.id);
        nextPairs.push({
          answerId: answer.id,
          localCode: answer.questionCode,
          localText: answer.questionText,
          dnpItem: best.item,
          similarity: best.sim,
          selected: true,
        });
      }
    }

    nextPairs.sort((a, b) => b.similarity - a.similarity);
    setPairs(nextPairs);
  }, [dnpItems, sessionInfo, threshold]);

  const toggleSelect = (answerId: string) => {
    setPairs((prev) =>
      prev.map((p) => (p.answerId === answerId ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleExpand = (answerId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return next;
    });
  };

  const selectedPairs = useMemo(() => pairs.filter((p) => p.selected), [pairs]);

  const { startPolling: startInjectPolling, stopPolling: stopInjectPolling } =
    useAsyncJobPolling<Awaited<ReturnType<typeof fetchAdminSelfAssessmentImportDnpInjectJob>>>({
      poll: fetchAdminSelfAssessmentImportDnpInjectJob,
      isPending: (response) =>
        response.status === 'queued' || response.status === 'running',
      onSuccess: (response) => {
        const summary = response.summary ?? null;
        setInjecting(false);
        setInjectResult({
          injectedCount: summary?.injectedCount ?? 0,
          message: summary?.message ?? response.message ?? 'Inject jawaban DNP selesai.',
        });
        setStep('done');
        toast({
          title: 'Inject berhasil',
          description:
            summary?.message || response.message || 'Inject jawaban DNP selesai diproses.',
        });
      },
      onFailure: (response) => {
        setInjecting(false);
        toast({
          title: 'Gagal inject',
          description: response.error ?? response.message ?? 'Terjadi kesalahan.',
        });
      },
      onError: (error) => {
        setInjecting(false);
        toast({
          title: 'Gagal inject',
          description: error.message || 'Terjadi kesalahan.',
        });
      },
    });

  /* ── Inject ── */
  const handleInject = async () => {
    if (!sessionAreaId || !userId || selectedPairs.length === 0) return;
    setInjecting(true);
    try {
      const resp = await injectAdminSelfAssessmentFromDnp({
        sessionAreaId,
        userId,
        matches: selectedPairs.map((p) => ({
          answerId: p.answerId,
          dnpSnapshotItemId: p.dnpItem.id,
        })),
      });
      toast({
        title: 'Inject dimulai',
        description: resp.message || 'Inject jawaban DNP sedang diproses di background.',
      });
      if (!resp.jobId) throw new Error('Job inject tidak tersedia.');
      stopInjectPolling();
      void startInjectPolling(resp.jobId);
    } catch (err) {
      setInjecting(false);
      toast({
        title: 'Gagal inject',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    }
  };

  /* ─── render ─── */
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Memuat data sesi…
      </div>
    );
  }

  if (!sessionInfo) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        Sesi tidak ditemukan.{' '}
        <Link to="/admin/self-assessment-import-dnp" className="text-blue-500 underline">
          Kembali
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/self-assessment-import-dnp">
          <Button variant="ghost" size="sm" className="gap-1 text-slate-500">
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Button>
        </Link>
        <div>
          <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Import DNP
          </h1>
          <p className="text-xs text-slate-500">
            {sessionInfo.area} · User: {sessionInfo.userName}
            {sessionInfo.schedule ? ` · ${sessionInfo.schedule}` : ''}
          </p>
        </div>
      </div>

      {/* step indicator */}
      <div className="flex items-center gap-1 text-xs">
        {(['login', 'area', 'compare', 'done'] as const).map((s, i, arr) => {
          const currentIdx = ['login', 'area', 'fetching', 'compare', 'done'].indexOf(
            step === 'fetching' ? 'area' : step
          );
          const thisIdx = ['login', 'area', 'compare', 'done'].indexOf(s);
          const active = currentIdx >= thisIdx;
          return (
            <div key={s} className="flex items-center gap-1">
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${
                  active
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                {i + 1}.{' '}
                {{ login: 'Login', area: 'Pilih Area', compare: 'Cocokkan', done: 'Selesai' }[s]}
              </span>
              {i < arr.length - 1 && (
                <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
              )}
            </div>
          );
        })}
      </div>

      {/* ── STEP: login ── */}
      {(step === 'login') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Login ke Portal DNP
              </h2>
              <p className="text-xs text-slate-500">Masukkan kredensial dan captcha untuk mengambil daftar area.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Username DNP</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Password DNP</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Tahun</label>
              <Input
                value={dnpYear}
                onChange={(e) => setDnpYear(e.target.value)}
                placeholder="2025"
                maxLength={4}
              />
            </div>
          </div>

          {/* captcha row */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Captcha</label>
              <Input
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                placeholder="Ketik teks captcha"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Gambar Captcha</label>
              <div className="flex items-center gap-2">
                {captchaUrl ? (
                  <img
                    src={resolveApiUrl(captchaUrl)}
                    alt="captcha"
                    className="h-10 rounded border border-slate-200 bg-white dark:border-slate-700"
                  />
                ) : (
                  <div className="flex h-10 w-24 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                    —
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGetCaptcha}
                  disabled={captchaLoading}
                  className="gap-1.5"
                >
                  {captchaLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {captchaUrl ? 'Refresh' : 'Muat Captcha'}
                </Button>
              </div>
            </div>
          </div>

          {fetchError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-400">
              {fetchError}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              className="gap-2 bg-blue-500 text-white hover:bg-blue-600"
              onClick={handleGetAreas}
              disabled={
                areaLoading ||
                !dnpSessionId ||
                !username.trim() ||
                !password.trim() ||
                !captcha.trim() ||
                !dnpYear.trim()
              }
            >
              {areaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {areaLoading ? 'Login…' : 'Login & Muat Area'}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP: area ── */}
      {(step === 'area') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Pilih Area DNP
            </h2>
            <p className="text-xs text-slate-500">Pilih area yang sesuai lalu ambil data pertanyaan dari DNP.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Area Target</label>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={selectedAreaKey}
              onChange={(e) => setSelectedAreaKey(e.target.value)}
            >
              {areas.map((a) => (
                <option key={`${a.fillCode1}::${a.fillCode2}`} value={`${a.fillCode1}::${a.fillCode2}`}>
                  {a.area} ({a.fillCode1}/{a.fillCode2})
                </option>
              ))}
            </select>
          </div>

          {fetchError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-400">
              {fetchError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setStep('login')}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Kembali ke Login
            </Button>
            <Button
              className="gap-2 bg-blue-500 text-white hover:bg-blue-600"
              onClick={handleFetchDnpData}
              disabled={!selectedAreaKey}
            >
              <Download className="h-4 w-4" />
              Ambil Data DNP
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP: fetching ── */}
      {step === 'fetching' && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-16 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-sm text-slate-600 dark:text-slate-300">{fetchStatus}</p>
          <p className="text-xs text-slate-400">Harap tunggu, sedang mengambil dari portal DNP…</p>
        </div>
      )}

      {/* ── STEP: compare ── */}
      {step === 'compare' && (
        <div className="space-y-4">
          {/* threshold slider */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Threshold Kemiripan Pertanyaan
                </p>
                <p className="text-xs text-slate-500">
                  Hanya pasangan dengan similarity ≥ threshold yang akan diinjeksi.
                </p>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                {threshold}%
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-3 w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>40%</span>
              <span>100%</span>
            </div>
          </div>

          {/* summary */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {sessionInfo.answers.length} pertanyaan lokal
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              {dnpItems.length} data DNP
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {pairs.length} pasangan ditemukan
            </span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
              {selectedPairs.length} dipilih untuk inject
            </span>
          </div>

          {pairs.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-400">
              Tidak ada pasangan yang memenuhi threshold {threshold}%. Coba turunkan threshold.
            </div>
          ) : (
            <>
              {/* pair table */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-x-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <span>✓</span>
                  <span>Pertanyaan Lokal</span>
                  <span>Pertanyaan DNP</span>
                  <span className="text-center">Sim.</span>
                  <span />
                </div>
                {pairs.map((pair) => {
                  const expanded = expandedRows.has(pair.answerId);
                  return (
                    <div
                      key={pair.answerId}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-start gap-x-3 px-4 py-3">
                        {/* checkbox */}
                        <input
                          type="checkbox"
                          checked={pair.selected}
                          onChange={() => toggleSelect(pair.answerId)}
                          className="mt-1 h-4 w-4 accent-blue-500"
                        />
                        {/* local */}
                        <div className="text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {pair.localCode}
                          </span>
                          <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                            {pair.localText}
                          </p>
                        </div>
                        {/* dnp */}
                        <div className="text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {pair.dnpItem.questionCode ?? '—'}
                          </span>
                          <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                            {pair.dnpItem.questionText ?? '—'}
                          </p>
                        </div>
                        {/* similarity */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getDnpMatchToneClass(pair.similarity, threshold)}`}
                        >
                          {pair.similarity}%
                        </span>
                        {/* expand toggle */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(pair.answerId)}
                          className="ml-1 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {/* expanded: DNP isi yang akan di-inject */}
                      {expanded && (
                        <div className="mx-4 mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs space-y-2 dark:border-slate-800 dark:bg-slate-800/50">
                          <div>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Status DNP:</span>{' '}
                            <span className="text-slate-700 dark:text-slate-200">
                              {pair.dnpItem.status ?? '—'}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Comment DNP:</span>
                            <p className="mt-0.5 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                              {pair.dnpItem.comment || '—'}
                            </p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">Evidence Note DNP:</span>
                            <p className="mt-0.5 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                              {pair.dnpItem.evidenceNote || '—'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* select all / inject bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedPairs.length === pairs.length}
                    onChange={(e) =>
                      setPairs((prev) => prev.map((p) => ({ ...p, selected: e.target.checked })))
                    }
                    className="h-4 w-4 accent-blue-500"
                  />
                  <label htmlFor="select-all" className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                    Pilih semua ({pairs.length})
                  </label>
                </div>
                <Button
                  className="gap-2 bg-emerald-500 text-white hover:bg-emerald-600"
                  onClick={handleInject}
                  disabled={injecting || selectedPairs.length === 0}
                >
                  {injecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {injecting
                    ? 'Menginjeksi…'
                    : `Inject ${selectedPairs.length} Pasangan ke Sesi Lokal`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP: done ── */}
      {step === 'done' && injectResult && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm dark:border-emerald-500/30 dark:bg-emerald-900/20">
          <CheckCircle className="h-12 w-12 text-emerald-500" />
          <div>
            <h2 className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
              Inject Selesai!
            </h2>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              {injectResult.message || `${injectResult.injectedCount} jawaban berhasil diperbarui.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/self-assessment-import-dnp">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Kembali ke Daftar Sesi
              </Button>
            </Link>
            <Button
              size="sm"
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={() => {
                setStep('login');
                setDnpSessionId('');
                setCaptchaUrl('');
                setCaptcha('');
                setAreas([]);
                setSelectedAreaKey('');
                setDnpItems([]);
                setPairs([]);
                setInjectResult(null);
                setFetchError(null);
              }}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Import Ulang
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
