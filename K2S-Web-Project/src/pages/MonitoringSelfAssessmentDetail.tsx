import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ClipboardCheck,
  Search,
  SendHorizontal,
  UploadCloud,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormSection } from '@/components/shared/Form';
import { toast } from '@/hooks/use-toast';
import { resolveApiUrl } from '@/lib/api';
import { downloadFromSignedUrl } from '@/lib/download';
import { resolveTime } from '@/lib/monitoringReview';
import {
  fetchSelfAssessmentCap,
  submitSelfAssessmentCapFulfillment,
} from '@/lib/selfAssessment';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

type CapItem = {
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
      files: Array<{ id: string; name: string; url: string }>;
    }>;
  } | null;
};

type CapFulfillment = NonNullable<CapItem['cap']>['fulfillments'][number];

type StatusStyle = {
  row: string;
  text: string;
  pill: string;
};

const STATUS_STYLES: Record<string, StatusStyle> = {
  satisfactory: {
    row: 'bg-blue-50',
    text: 'text-blue-700',
    pill: 'bg-blue-100 text-[#1e3a8a]',
  },
  'not satisfactory': {
    row: 'bg-red-50',
    text: 'text-red-700',
    pill: 'bg-red-100 text-[#991b1b]',
  },
  'not applicable': {
    row: 'bg-pink-50',
    text: 'text-pink-700',
    pill: 'bg-pink-100 text-[#831843]',
  },
};

const VALID_SCOPES: SelfAssessmentScope[] = [
  'audit',
  'inspeksi',
  'surveillance',
  'monitoring',
];

const resolveStatusStyle = (status?: string | null) => {
  const key = status?.toLowerCase?.() ?? '';
  return STATUS_STYLES[key] ?? {
    row: 'bg-slate-50',
    text: 'text-slate-600',
    pill: 'bg-slate-100 text-[#475569]',
  };
};

const pickLatestFulfillment = (item: CapItem | null): CapFulfillment | null => {
  if (!item?.cap?.fulfillments?.length) return null;
  return item.cap.fulfillments
    .slice()
    .sort((a, b) => {
      const aTime = Math.max(resolveTime(a.submittedAt), resolveTime(a.createdAt));
      const bTime = Math.max(resolveTime(b.submittedAt), resolveTime(b.createdAt));
      return aTime - bTime;
    })
    .pop() ?? null;
};

export function MonitoringSelfAssessmentDetail() {
  const { scope, sessionAreaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<CapItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [step, setStep] = useState(1);
  const [proposeAction, setProposeAction] = useState('');
  const [actionOffice, setActionOffice] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [completeDate, setCompleteDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [fulfillmentFile, setFulfillmentFile] = useState<File | null>(null);

  const resolvedScope = useMemo(() => {
    const normalized = (scope ?? '').toLowerCase();
    return VALID_SCOPES.includes(normalized as SelfAssessmentScope)
      ? (normalized as SelfAssessmentScope)
      : null;
  }, [scope]);

  const requestedAnswerId = searchParams.get('answerId');

  const loadItems = useCallback(() => {
    if (!resolvedScope || !sessionAreaId) {
      setItems([]);
      setActiveId(null);
      return;
    }
    setIsLoading(true);
    fetchSelfAssessmentCap({ scope: resolvedScope, sessionAreaId })
      .then((data) => {
        setItems(data ?? []);
        setActiveId((prev) => {
          if (requestedAnswerId) {
            const match = data.find((item) => item.answerId === requestedAnswerId);
            if (match) return match.answerId;
          }
          return prev ?? data[0]?.answerId ?? null;
        });
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat data monitoring',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  }, [resolvedScope, sessionAreaId, requestedAnswerId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.questionCode} ${item.questionText}`.toLowerCase().includes(term)
    );
  }, [items, searchText]);

  const activeItem = items.find((item) => item.answerId === activeId) ?? null;
  const latestFulfillment = useMemo(
    () => pickLatestFulfillment(activeItem),
    [activeItem]
  );
  const hasSentFulfillment = Boolean(
    activeItem?.cap?.fulfillments?.some((fulfillment) => fulfillment.status === 'sent')
  );
  const canFulfill = Boolean(activeItem?.cap?.review?.reviewedAt);

  useEffect(() => {
    if (latestFulfillment) {
      const baseStep = Number.isFinite(latestFulfillment.step) && latestFulfillment.step > 0
        ? latestFulfillment.step
        : 1;
      const resolvedStep = latestFulfillment.status === 'sent' ? baseStep + 1 : baseStep;
      setStep(resolvedStep);
      setProposeAction(latestFulfillment.proposeAction);
      setActionOffice(latestFulfillment.actionOffice);
      setEvidenceReference(latestFulfillment.evidenceReference ?? '');
      setCompleteDate(latestFulfillment.completeDate ?? '');
      setProgress(latestFulfillment.progress ?? 0);
    } else {
      setStep(1);
      setProposeAction('');
      setActionOffice('');
      setEvidenceReference('');
      setCompleteDate('');
      setProgress(0);
    }
    setFulfillmentFile(null);
  }, [latestFulfillment, activeId]);

  const submitFulfillment = (action: 'draft' | 'send') => {
    if (!activeItem?.cap) {
      toast({
        title: 'CAP belum tersedia',
        description: 'Pemenuhan CAP belum tersedia untuk pertanyaan ini.',
      });
      return;
    }
    if (!canFulfill) {
      toast({
        title: 'Review CAP belum tersedia',
        description: 'Pemenuhan CAP bisa diisi setelah review CAP dikirim.',
      });
      return;
    }
    if (!proposeAction.trim() || !actionOffice.trim() || !completeDate) {
      toast({
        title: 'Data belum lengkap',
        description:
          'Capaian rencana tindak lanjut, comment, dan due date wajib diisi.',
      });
      return;
    }
    setIsSaving(true);
    submitSelfAssessmentCapFulfillment({
      capId: activeItem.cap.id,
      step,
      proposeAction,
      actionOffice,
      evidenceReference: evidenceReference.trim() ? evidenceReference : undefined,
      completeDate,
      progress,
      action,
      file: fulfillmentFile ?? undefined,
    })
      .then(() => {
        toast({
          title: action === 'send' ? 'Pemenuhan monitoring dikirim' : 'Draft tersimpan',
          description:
            action === 'send'
              ? 'Pemenuhan monitoring berhasil dikirim dan menunggu review admin.'
              : 'Pemenuhan monitoring disimpan sebagai draft.',
        });
        loadItems();
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal menyimpan pemenuhan monitoring',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSaving(false));
  };

  if (!resolvedScope || !sessionAreaId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Data monitoring tidak ditemukan.
      </div>
    );
  }

  const isFormDisabled = !activeItem?.cap || !canFulfill || isSaving;

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
                Monitoring / Protocol Question (PQ)
              </p>
              <h1 className="text-lg font-semibold text-slate-800">
                Protocol Question (PQ)
              </h1>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/monitoring/protocol-question/self-assessment')}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
        </header>

        <div className="space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="text-slate-500">Ket :</span>
            <span className="rounded-md bg-blue-100 px-2 py-1 text-[#1e3a8a]">
              Satisfactory
            </span>
            <span className="rounded-md bg-red-100 px-2 py-1 text-[#991b1b]">
              Not Satisfactory
            </span>
            <span className="rounded-md bg-pink-100 px-2 py-1 text-[#831843]">
              Not Applicable
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  LIST PROTOCOL QUESTION
                </h2>
                <Button variant="outline" size="sm" disabled>
                  Kirim Semua
                </Button>
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

              <div className="overflow-hidden rounded-xl border border-slate-200">
                {isLoading ? (
                  <div className="px-3 py-4 text-sm text-slate-500">
                    Memuat data...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-500">
                    Tidak ada protocol question dari pemenuhan CAP.
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredItems.map((item) => {
                      const isActive = activeId === item.answerId;
                      const statusStyle = resolveStatusStyle(item.status);
                      const normalizedStatus = (item.status ?? '').trim().toLowerCase();
                      const hasStatusTone =
                        normalizedStatus === 'satisfactory' ||
                        normalizedStatus === 'not satisfactory' ||
                        normalizedStatus === 'not applicable' ||
                        normalizedStatus === 'not aplicable';
                      const rowClass = hasStatusTone
                        ? `${statusStyle.row} text-slate-700 hover:bg-amber-300`
                        : isActive
                        ? 'bg-blue-100 text-slate-900 hover:bg-amber-300'
                        : 'bg-slate-50 text-slate-700 hover:bg-amber-300';
                      const hasSent = Boolean(
                        item.cap?.fulfillments?.some(
                          (fulfillment) => fulfillment.status === 'sent'
                        )
                      );
                      const hasDraft = Boolean(
                        item.cap?.fulfillments?.some(
                          (fulfillment) => fulfillment.status === 'draft'
                        )
                      );
                      return (
                        <button
                          key={item.answerId}
                          type="button"
                          className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition ${rowClass}`}
                          onClick={() => setActiveId(item.answerId)}
                        >
                          <span
                            className={`mt-1 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] font-semibold ${
                              hasSent
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                                : hasDraft
                                ? 'border-amber-500 bg-amber-50 text-amber-600'
                                : 'border-slate-300 bg-white text-slate-400'
                            }`}
                          >
                            {hasSent ? (
                              <Check className="h-3 w-3" />
                            ) : hasDraft ? (
                              '•'
                            ) : null}
                          </span>
                          <div className="flex-1">
                            <span className="font-semibold">{item.questionCode}</span>{' '}
                            - {item.questionText}
                          </div>
                          <SendHorizontal className="mt-1 h-4 w-4 text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {!activeItem ? (
                <div className="text-sm text-slate-500">
                  Pilih protocol question.
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">
                      Upload file evidence <span className="text-red-500">*</span>
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Your file will be upload to server
                    </p>
                  </div>
                  <div className="relative flex min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center">
                    <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
                      <UploadCloud className="h-6 w-6 text-slate-400" />
                      Drop files here or click to upload.
                    </div>
                    <input
                      type="file"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      onChange={(event) =>
                        setFulfillmentFile(event.target.files?.[0] ?? null)
                      }
                      disabled={isFormDisabled}
                    />
                  </div>
                  {latestFulfillment?.files?.length ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      <div className="mb-2 text-xs font-semibold text-slate-600">
                        File evidence existing
                      </div>
                      <div className="space-y-2">
                        {latestFulfillment.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                          >
                            <a
                              href={resolveApiUrl(file.url)}
                              className="truncate text-blue-600 underline"
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
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="text-xs text-slate-500">
                    *File yang diperbolehkan: JPG, JPEG, PDF, DOCX, PNG, MP3, MP4,
                    XLSX
                    <br />
                    *Max size : 20MB
                  </div>

                  {!activeItem.cap && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                      CAP belum tersedia untuk pertanyaan ini.
                    </div>
                  )}
                  {activeItem.cap && !canFulfill && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                      {hasSentFulfillment
                        ? 'Pemenuhan sudah dikirim. Menunggu review admin, hasil review akan tampil setelah dikirim.'
                        : 'Review CAP belum tersedia. Pemenuhan CAP bisa dikirim setelah review CAP.'}
                    </div>
                  )}
                  {activeItem.cap?.review && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-800">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">
                        Hasil Review CAP
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <span className="font-semibold">Result:</span>{' '}
                          {activeItem.cap.review.result ?? '-'}
                        </div>
                        <div>
                          <span className="font-semibold">Status:</span>{' '}
                          {activeItem.cap.review.status ?? '-'}
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-semibold">Comment:</span>{' '}
                          {activeItem.cap.review.comment ?? '-'}
                        </div>
                        <div>
                          <span className="font-semibold">Reviewed By:</span>{' '}
                          {activeItem.cap.review.reviewedBy?.name ?? '-'}
                        </div>
                        <div>
                          <span className="font-semibold">Reviewed At:</span>{' '}
                          {activeItem.cap.review.reviewedAt ?? 'Menunggu review'}
                        </div>
                      </div>
                    </div>
                  )}

                  <FormSection title="Data Assessment">
                    <div className="grid gap-4">
                      <FormField label="Protocol Question">
                        <Textarea rows={3} value={activeItem.questionText} disabled />
                      </FormField>
                      <FormField label="Referensi Regulasi">
                        <Textarea
                          rows={2}
                          value={activeItem.reference ?? ''}
                          disabled
                        />
                      </FormField>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField label="Temuan">
                          <Textarea
                            rows={3}
                            value={activeItem.review?.finding ?? ''}
                            disabled
                          />
                        </FormField>
                        <FormField label="Current Mitigation">
                          <Textarea
                            rows={3}
                            value={activeItem.cap?.actionPlan ?? ''}
                            disabled
                          />
                        </FormField>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField label="Remark">
                          <Textarea
                            rows={3}
                            value={
                              activeItem.review?.description ??
                              activeItem.review?.resume ??
                              ''
                            }
                            disabled
                          />
                        </FormField>
                        <FormField label="Due Date" required>
                          <Input
                            type="date"
                            value={completeDate}
                            onChange={(event) => setCompleteDate(event.target.value)}
                            disabled={isFormDisabled}
                          />
                        </FormField>
                      </div>
                    </div>
                  </FormSection>

                  <div className="grid gap-6 md:grid-cols-[1fr_220px]">
                    <div className="space-y-4">
                      <FormField label="Status of Implementation" required>
                        <select
                          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                          value={progress}
                          onChange={(event) => setProgress(Number(event.target.value))}
                          disabled={isFormDisabled}
                        >
                          {[0, 25, 50, 75, 100].map((value) => (
                            <option key={value} value={value}>
                              {value}%
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Comment">
                        <Textarea
                          rows={3}
                          value={actionOffice}
                          onChange={(event) => setActionOffice(event.target.value)}
                          disabled={isFormDisabled}
                        />
                      </FormField>
                      <FormField label="Evidence">
                        <Textarea
                          rows={3}
                          value={evidenceReference}
                          onChange={(event) => setEvidenceReference(event.target.value)}
                          disabled={isFormDisabled}
                        />
                      </FormField>
                      <FormField label="Capaian Rencana Tindak Lanjut" required>
                        <Textarea
                          rows={3}
                          value={proposeAction}
                          onChange={(event) => setProposeAction(event.target.value)}
                          disabled={isFormDisabled}
                        />
                      </FormField>
                    </div>
                    <div className="space-y-3">
                      <FormField label="Created By">
                        <Input value="-" disabled />
                      </FormField>
                      <FormField label="Created At">
                        <Input value={latestFulfillment?.createdAt ?? '-'} disabled />
                      </FormField>
                      <FormField label="Edited By">
                        <Input value="-" disabled />
                      </FormField>
                      <FormField label="Last Modified">
                        <Input
                          value={latestFulfillment?.submittedAt ?? '-'}
                          disabled
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="text-xs text-red-500">
                    Kolom dengan tanda bintang wajib diisi.
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => submitFulfillment('draft')}
                      disabled={isFormDisabled}
                    >
                      Simpan Draft
                    </Button>
                    <Button
                      className="bg-blue-500 text-white hover:bg-blue-600"
                      onClick={() => submitFulfillment('send')}
                      disabled={isFormDisabled}
                    >
                      Kirim
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
