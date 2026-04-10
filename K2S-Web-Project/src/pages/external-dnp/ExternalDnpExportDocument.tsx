import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { getAuthUser } from '@/lib/api';
import { downloadApiFile } from '@/lib/download';
import { canManageExternalDnp } from '@/lib/permissions';
import {
  fetchExternalDnpSyncJobStatus,
  fetchExternalDnpExportDocumentItems,
  generateExternalDnpExportDocument,
  initExternalDnpSync,
  startExternalDnpSyncJob,
  type ExternalDnpExportDocumentItem,
} from '@/lib/externalDnp';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

const SCOPE_OPTIONS: Array<{ value: SelfAssessmentScope; label: string }> = [
  { value: 'audit', label: 'Audit' },
  { value: 'inspeksi', label: 'Inspeksi' },
  { value: 'surveillance', label: 'Surveillance' },
];

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-950 dark:text-slate-100 sm:w-56';
const EXPORT_DOCUMENT_SYNC_QUEUE_KEY = 'k2s.externalDnp.exportDocument.syncQueue';

type SyncQueueEntry = {
  jobId: string;
  username: string;
};

function extractScheduleYear(schedule: string) {
  return schedule.match(/\b(20\d{2}|19\d{2})\b/)?.[1] ?? '';
}

export function ExternalDnpExportDocument() {
  const authUser = getAuthUser<{ role?: string; permissions?: Record<string, unknown> }>();
  const canManageExternalDnpData = canManageExternalDnp(authUser);
  const [scope, setScope] = useState<SelfAssessmentScope>('audit');
  const [items, setItems] = useState<ExternalDnpExportDocumentItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedInstansi, setSelectedInstansi] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncSubmitting, setIsSyncSubmitting] = useState(false);
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [syncUsername, setSyncUsername] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncQueue, setSyncQueue] = useState<SyncQueueEntry[]>([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFilename, setDownloadFilename] = useState('external-dnp-export.doc');

  const loadItems = async (nextScope: SelfAssessmentScope) => {
    setIsLoading(true);
    setSelectedGroupIds([]);
    setSelectedInstansi('all');
    setSelectedYear('all');
    try {
      const response = await fetchExternalDnpExportDocumentItems(nextScope);
      setItems(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat daftar dokumen.';
      toast({
        title: 'Gagal memuat data',
        description: message,
        variant: 'destructive',
      });
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadItems(scope);
  }, [scope]);

  useEffect(() => {
    setSelectedGroupIds([]);
  }, [selectedInstansi, selectedYear]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(EXPORT_DOCUMENT_SYNC_QUEUE_KEY) ?? '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSyncQueue(
          parsed.filter(
            (item): item is SyncQueueEntry =>
              Boolean(item)
              && typeof item === 'object'
              && typeof item.jobId === 'string'
              && item.jobId.trim() !== ''
              && typeof item.username === 'string'
          )
        );
      }
    } catch {
      window.localStorage.removeItem(EXPORT_DOCUMENT_SYNC_QUEUE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!canManageExternalDnpData) {
      return;
    }

    if (syncQueue.length === 0) {
      return;
    }

    let stopped = false;

    const poll = async () => {
      try {
        const results = await Promise.all(
          syncQueue.map(async (entry) => ({
            entry,
            status: await fetchExternalDnpSyncJobStatus(entry.jobId),
          }))
        );

        if (stopped) {
          return;
        }

        const finishedJobIds = new Set<string>();
        let shouldReload = false;

        results.forEach(({ entry, status }) => {
          if (status.status === 'succeeded') {
            finishedJobIds.add(entry.jobId);
            shouldReload = true;
            toast({
              title: 'Update selesai',
              description: status.message ?? `Sinkronisasi semua scope untuk ${entry.username} berhasil diperbarui.`,
            });
            return;
          }

          if (status.status === 'failed') {
            finishedJobIds.add(entry.jobId);
            toast({
              title: 'Gagal memperbarui data',
              description: status.error ?? status.message ?? `Terjadi kesalahan saat memproses ${entry.username}.`,
              variant: 'destructive',
            });
          }
        });

        if (finishedJobIds.size > 0) {
          const remainingQueue = syncQueue.filter(({ jobId }) => !finishedJobIds.has(jobId));
          setSyncQueue(remainingQueue);
          if (typeof window !== 'undefined') {
            if (remainingQueue.length > 0) {
              window.localStorage.setItem(EXPORT_DOCUMENT_SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
            } else {
              window.localStorage.removeItem(EXPORT_DOCUMENT_SYNC_QUEUE_KEY);
            }
          }
          if (shouldReload) {
            await loadItems(scope);
          }
        }

        window.setTimeout(() => {
          if (!stopped) {
            void poll();
          }
        }, 2500);
      } catch {
        if (stopped) {
          return;
        }

        window.setTimeout(() => {
          if (!stopped) {
            void poll();
          }
        }, 3000);
      }
    };

    void poll();

    return () => {
      stopped = true;
    };
  }, [canManageExternalDnpData, scope, syncQueue]);

  const instansiOptions = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.instansiName || '-').filter((value) => value.trim() !== ''))
      ).sort((left, right) => left.localeCompare(right)),
    [items]
  );

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => extractScheduleYear(item.schedule || '')).filter(Boolean))
      ).sort((left, right) => right.localeCompare(left)),
    [items]
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const instansiMatches =
          selectedInstansi === 'all' || (item.instansiName || '-') === selectedInstansi;
        const yearMatches =
          selectedYear === 'all' || extractScheduleYear(item.schedule || '') === selectedYear;

        return instansiMatches && yearMatches;
      }),
    [items, selectedInstansi, selectedYear]
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        id: string;
        instansiName: string;
        area: string;
        leader: string;
        members: string[];
        audity: string[];
        schedule: string;
        itemIds: string[];
      }
    >();

    filteredItems.forEach((item) => {
      const key = item.sessionAreaId || [item.instansiName, item.area, item.schedule, item.leader].join('::');
      const existing = groups.get(key);
      if (existing) {
        existing.itemIds.push(item.id);
        return;
      }

      groups.set(key, {
        id: key,
        instansiName: item.instansiName || '-',
        area: item.area || '-',
        leader: item.leader || '-',
        members: item.members || [],
        audity: item.audity || [],
        schedule: item.schedule || '-',
        itemIds: [item.id],
      });
    });

    return Array.from(groups.values());
  }, [filteredItems]);

  const allSelected = useMemo(
    () => groupedItems.length > 0 && selectedGroupIds.length === groupedItems.length,
    [groupedItems.length, selectedGroupIds.length]
  );

  const toggleSelectAll = (checked: boolean) => {
    setSelectedGroupIds(checked ? groupedItems.map((group) => group.id) : []);
  };

  const toggleSelectGroup = (groupId: string, checked: boolean) => {
    setSelectedGroupIds((current) =>
      checked ? Array.from(new Set([...current, groupId])) : current.filter((id) => id !== groupId)
    );
  };

  const handleGenerate = async () => {
    if (selectedGroupIds.length === 0) {
      toast({
        title: 'Belum ada data dipilih',
        description: 'Pilih minimal satu pemenuhan CAP untuk digenerate.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateExternalDnpExportDocument({
        scope,
        itemIds: selectedGroupIds,
      });
      setDownloadUrl(response.downloadUrl);
      setDownloadFilename(response.filename);
      await downloadApiFile(response.downloadUrl, response.filename);
      toast({
        title: 'Dokumen berhasil digenerate',
        description: `${response.totalItems} data masuk ke dokumen ${scope}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal generate dokumen.';
      toast({
        title: 'Generate gagal',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadLatest = async () => {
    if (!downloadUrl) {
      toast({
        title: 'Belum ada dokumen',
        description: 'Generate dokumen terlebih dahulu untuk scope ini.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await downloadApiFile(downloadUrl, downloadFilename);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengunduh dokumen.';
      toast({
        title: 'Download gagal',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleSyncInit = async () => {
    if (!canManageExternalDnpData) {
      return;
    }

    setIsSyncSubmitting(true);
    try {
      const init = await initExternalDnpSync();
      setCaptchaSessionId(init.sessionId);
      setCaptchaUrl(init.captchaUrl);
      setCaptchaValue('');
      setSyncUsername('');
      setSyncPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memulai update data.';
      toast({
        title: 'Gagal memulai update',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncSubmitting(false);
    }
  };

  const handleSyncRun = async () => {
    if (!canManageExternalDnpData || !captchaSessionId || !captchaValue || !syncUsername || !syncPassword) {
      return;
    }

    setIsSyncSubmitting(true);
    try {
      const queuedUsername = syncUsername.trim();
      const started = await startExternalDnpSyncJob({
        sessionId: captchaSessionId,
        captcha: captchaValue,
        username: syncUsername,
        password: syncPassword,
      });

      const nextQueue = [
        ...syncQueue.filter(({ jobId }) => jobId !== started.jobId),
        {
          jobId: started.jobId,
          username: queuedUsername || 'Tanpa username',
        },
      ];
      setSyncQueue(nextQueue);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(EXPORT_DOCUMENT_SYNC_QUEUE_KEY, JSON.stringify(nextQueue));
      }

      toast({
        title: 'Update dimulai',
        description: started.message ?? `Sinkronisasi semua scope untuk ${queuedUsername || 'akun DNP'} masuk ke antrean background.`,
      });

      setCaptchaSessionId('');
      setCaptchaUrl('');
      setCaptchaValue('');
      setSyncUsername('');
      setSyncPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memulai update data.';
      toast({
        title: 'Gagal memulai update',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">Export Document External DNP</h1>
                <p className="text-sm text-slate-500">
                  Pilih scope terlebih dahulu, centang daftar pemenuhan CAP, lalu generate dokumen Word.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                onClick={() => void loadItems(scope)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memuat
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
              {canManageExternalDnpData && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                  onClick={() => void handleSyncInit()}
                  disabled={isSyncSubmitting}
                >
                  {isSyncSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memuat
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Update Data
                    </>
                  )}
                </Button>
              )}
              <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                {SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope}
              </span>
            </div>
            {canManageExternalDnpData && syncQueue.length > 0 && (
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {syncQueue.length} job update dalam antrean
              </div>
            )}
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          {!canManageExternalDnpData && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Mode lihat saja. User non-admin hanya bisa melihat dan generate dokumen dari data instansi External DNP yang diizinkan admin.
            </div>
          )}
          {captchaUrl && canManageExternalDnpData && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm font-semibold text-slate-700">
                  Masukkan Akun DNP dan Captcha untuk Update Data Semua Scope
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-slate-200 px-3 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                  onClick={() => void handleSyncInit()}
                  disabled={isSyncSubmitting}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Ganti Captcha
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Input
                  value={syncUsername}
                  onChange={(event) => setSyncUsername(event.target.value)}
                  className="h-11 w-48 rounded-xl bg-white"
                  placeholder="Username DNP"
                  autoComplete="username"
                />
                <Input
                  type="password"
                  value={syncPassword}
                  onChange={(event) => setSyncPassword(event.target.value)}
                  className="h-11 w-48 rounded-xl bg-white"
                  placeholder="Password DNP"
                  autoComplete="current-password"
                />
                <img
                  src={captchaUrl}
                  alt="Captcha"
                  className="h-12 rounded-lg border border-slate-200"
                />
                <Input
                  value={captchaValue}
                  onChange={(event) => setCaptchaValue(event.target.value)}
                  className="h-11 w-48 rounded-xl bg-white"
                  placeholder="Isi captcha"
                />
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
                  onClick={() => void handleSyncRun()}
                  disabled={isSyncSubmitting || !syncUsername || !syncPassword || !captchaValue}
                >
                  {isSyncSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memproses
                    </>
                  ) : (
                    'Update Sekarang'
                  )}
                </Button>
              </div>
              {syncQueue.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  <div className="mb-2 font-semibold text-slate-700 dark:text-slate-100">
                    Antrean update yang sedang berjalan
                  </div>
                  <ul className="space-y-1">
                    {syncQueue.map((entry, index) => (
                      <li key={entry.jobId} className="flex items-center gap-2">
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                          {index + 1}
                        </span>
                        <span className="font-medium">{entry.username || 'Tanpa username'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as SelfAssessmentScope)}
              className={selectClassName}
            >
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={selectedInstansi}
              onChange={(event) => setSelectedInstansi(event.target.value)}
              className={selectClassName}
              disabled={isLoading || instansiOptions.length === 0}
            >
              <option value="all">Semua instansi</option>
              {instansiOptions.map((instansi) => (
                <option key={instansi} value={instansi}>
                  {instansi}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className={selectClassName}
              disabled={isLoading || yearOptions.length === 0}
            >
              <option value="all">Semua tahun</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <Button
              type="button"
              className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
              onClick={handleGenerate}
              disabled={isGenerating || selectedGroupIds.length === 0}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate Document
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
              onClick={handleDownloadLatest}
              disabled={!downloadUrl}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Latest
            </Button>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {selectedGroupIds.length} dari {groupedItems.length} grup dipilih
              <span className="ml-2 text-slate-400">({filteredItems.length} item)</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <Table>
              <TableHeader className="bg-slate-100/90 dark:bg-slate-800/80">
                <TableRow>
                  <TableHead className="w-14 border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                      aria-label="Pilih semua"
                    />
                  </TableHead>
                  <TableHead className="w-16 border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">No</TableHead>
                  <TableHead className="border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">Instansi</TableHead>
                  <TableHead className="border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">Area</TableHead>
                  <TableHead className="border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">Ketua Tim</TableHead>
                  <TableHead className="border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">Anggota</TableHead>
                  <TableHead className="border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">Audity</TableHead>
                  <TableHead className="border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 dark:border-slate-700 dark:text-slate-300">Tanggal Pelaksanaan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-500 dark:text-slate-300">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat daftar pemenuhan CAP...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-500 dark:text-slate-300">
                      Belum ada data pemenuhan CAP yang cocok dengan filter ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedItems.map((group, index) => (
                    <TableRow
                      key={group.id}
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-900"
                    >
                      <TableCell className="align-top text-center">
                        <Checkbox
                          checked={selectedGroupIds.includes(group.id)}
                          onCheckedChange={(checked) => toggleSelectGroup(group.id, checked === true)}
                          aria-label={`Pilih ${group.instansiName}`}
                        />
                      </TableCell>
                      <TableCell className="align-top text-center text-slate-600 dark:text-slate-200">{index + 1}</TableCell>
                      <TableCell className="align-top font-medium text-slate-800 dark:text-slate-100">{group.instansiName}</TableCell>
                      <TableCell className="align-top">
                        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200">
                          {group.area}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-slate-700 dark:text-slate-200">{group.leader}</TableCell>
                      <TableCell className="align-top text-slate-700 dark:text-slate-200">
                        {group.members.length > 0 ? (
                          <ol className="list-decimal space-y-1 pl-5">
                            {group.members.map((member) => (
                              <li key={member}>{member}</li>
                            ))}
                          </ol>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="align-top text-slate-700 dark:text-slate-200">
                        {group.audity.length > 0 ? (
                          <ol className="list-decimal space-y-1 pl-5">
                            {group.audity.map((member) => (
                              <li key={member}>{member}</li>
                            ))}
                          </ol>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="align-top text-slate-700 dark:text-slate-200">{group.schedule}</TableCell>
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
