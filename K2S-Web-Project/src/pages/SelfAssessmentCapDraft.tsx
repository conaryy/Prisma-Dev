import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { getAuthUser } from '@/lib/api';
import { canManageExternalDnp } from '@/lib/permissions';
import {
  fetchSelfAssessmentCap,
  submitSelfAssessmentCap,
} from '@/lib/selfAssessment';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

interface SelfAssessmentCapDraftProps {
  scope: SelfAssessmentScope;
  sessionAreaId: string;
  fetchCap?: typeof fetchSelfAssessmentCap;
  submitCap?: typeof submitSelfAssessmentCap;
  allowSend?: boolean;
  enableQuestionPagination?: boolean;
  questionPageSize?: number;
}

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
  } | null;
};

export function SelfAssessmentCapDraft({
  scope,
  sessionAreaId,
  fetchCap,
  submitCap,
  allowSend = true,
  enableQuestionPagination = false,
  questionPageSize = 8,
}: SelfAssessmentCapDraftProps) {
  const authUser = getAuthUser<{ role?: string; permissions?: Record<string, unknown> }>();
  const isReadOnlyExternalDnp = !allowSend && !canManageExternalDnp(authUser);
  const [items, setItems] = useState<CapItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [questionPage, setQuestionPage] = useState(1);
  const [actionPlan, setActionPlan] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const loadItems = () => {
    if (!sessionAreaId) {
      setItems([]);
      setActiveId(null);
      return;
    }
    const load = fetchCap ?? fetchSelfAssessmentCap;
    load({ scope, sessionAreaId })
      .then((data) => {
        setItems(data);
        setActiveId((prev) => prev ?? data[0]?.answerId ?? null);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      });
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, sessionAreaId]);

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

  useEffect(() => {
    if (!activeItem) {
      setActionPlan('');
      setTargetDate('');
      return;
    }
    setActionPlan(activeItem.cap?.actionPlan ?? '');
    setTargetDate(activeItem.cap?.targetDate ?? '');
  }, [activeItem]);

  const handleSubmit = (action: 'draft' | 'send') => {
    if (!activeItem || isReadOnlyExternalDnp) return;
    if (!actionPlan.trim() || !targetDate) {
      toast({
        title: 'Data belum lengkap',
        description: 'Action plan dan target date wajib diisi.',
      });
      return;
    }
    setIsSaving(true);
    const submit = submitCap ?? submitSelfAssessmentCap;
    submit({
      answerId: activeItem.answerId,
      actionPlan,
      targetDate,
      action,
    })
      .then(() => {
        toast({
          title: action === 'send' ? 'CAP dikirim' : 'CAP tersimpan',
          description:
            action === 'send'
              ? 'CAP berhasil dikirim ke admin.'
              : 'CAP disimpan sebagai draft.',
        });
        loadItems();
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal menyimpan CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSaving(false));
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
                {scope} / CAP
              </p>
              <h1 className="text-lg font-semibold text-slate-800">Penyusunan CAP</h1>
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
              <span className="text-xs text-slate-500">Search:</span>
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="overflow-hidden divide-y rounded-xl border border-slate-200">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">
                  Tidak ada pertanyaan Not Satisfactory.
                </div>
              ) : (
                pagedItems.map((item) => {
                  const isSent = item.cap?.status === 'sent';
                  const isDraft = Boolean(item.cap) && !isSent;
                  const showStatusBadge = isSent || isDraft;
                  const statusLabel = isSent ? 'Dikirim' : allowSend ? 'Draft' : 'Draft Lokal';
                  const rowClass =
                    isSent
                      ? 'bg-[#e9f7f1] text-slate-900 hover:bg-amber-300 dark:bg-emerald-900/30 dark:text-slate-100 dark:hover:bg-amber-500/60'
                      : isDraft
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
                    {showStatusBadge && (
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          isSent
                            ? 'bg-emerald-100 text-[#065f46]'
                            : 'bg-amber-100 text-[#92400e]'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    )}
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
              <div className="text-sm font-semibold text-slate-700">Review Self Assessment Unit Safety</div>
              {activeItem ? (
                <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Protocol Question</div>
                    <div>{activeItem.questionText}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Severity</div>
                    <div>{activeItem.review?.severity ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Finding</div>
                    <div>{activeItem.review?.finding ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Probability</div>
                    <div>{activeItem.review?.probability ?? '-'}</div>
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
                      Not Satisfactory
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Pilih pertanyaan.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-700">Penyusunan CAP</div>
              <div className="mt-4 space-y-3">
                {isReadOnlyExternalDnp && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Mode lihat saja. User non-admin hanya bisa melihat CAP External DNP sesuai instansi yang diberikan admin.
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-600">Action Plan *</label>
                  <Textarea
                    rows={4}
                    value={actionPlan}
                    disabled={isReadOnlyExternalDnp}
                    onChange={(event) => setActionPlan(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Target Date of Completion *</label>
                  <Input
                    type="date"
                    value={targetDate}
                    disabled={isReadOnlyExternalDnp}
                    onChange={(event) => setTargetDate(event.target.value)}
                  />
                </div>
                <div className="text-xs text-red-500">Kolom dengan tanda bintang wajib diisi.</div>
                {!isReadOnlyExternalDnp && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSubmit('draft')}
                      disabled={isSaving || !activeItem}
                    >
                      {allowSend ? 'Simpan Draft' : 'Simpan Draft (Lokal)'}
                    </Button>
                    {allowSend && (
                      <Button
                        className="bg-blue-500 text-white hover:bg-blue-600"
                        onClick={() => handleSubmit('send')}
                        disabled={isSaving || !activeItem}
                      >
                        Kirim
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
