import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ClipboardCheck } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  fetchAdminSelfAssessmentCapDetail,
  submitAdminSelfAssessmentCapReview,
} from '@/lib/selfAssessment';

const CAP_STATUS_OPTIONS = [
  { value: '', label: 'Pilih status' },
  { value: 'Satisfactory', label: 'Satisfactory' },
  { value: 'Not Satisfactory', label: 'Not Satisfactory' },
];

type CapDetail = {
  sessionAreaId: string;
  area: string;
  scope: string;
  schedule: string | null;
  team: { leader: string; dnp: string[]; kobo: string[] } | null;
  caps: Array<{
    id: string;
    answerId: string;
    questionCode: string | null;
    questionText: string;
    actionPlan: string | null;
    targetDate: string | null;
    sentAt: string | null;
    review: {
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
  }>;
};

export function SelfAssessmentCapReviews() {
  const { sessionAreaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CapDetail | null>(null);
  const [activeCapId, setActiveCapId] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const userId = searchParams.get('userId') ?? '';
  const requestedCapId = searchParams.get('capId') ?? '';
  const requestedAnswerId = searchParams.get('answerId') ?? '';

  const activeItem = useMemo(
    () => detail?.caps.find((item) => item.id === activeCapId) ?? null,
    [detail, activeCapId]
  );

  const loadItems = () => {
    if (!sessionAreaId || !userId) {
      setDetail(null);
      return;
    }
    setIsLoading(true);
    fetchAdminSelfAssessmentCapDetail({ sessionAreaId, userId })
      .then((data) => {
        setDetail(data);
        setActiveCapId((prev) => {
          if (requestedCapId) {
            const matchByCapId = data.caps.find((item) => item.id === requestedCapId);
            if (matchByCapId) return matchByCapId.id;
          }
          if (requestedAnswerId) {
            const matchByAnswerId = data.caps.find(
              (item) => item.answerId === requestedAnswerId
            );
            if (matchByAnswerId) return matchByAnswerId.id;
          }
          return prev ?? data.caps[0]?.id ?? null;
        });
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat CAP',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAreaId, userId, requestedCapId, requestedAnswerId]);

  useEffect(() => {
    if (!activeItem) {
      setResult('');
      setComment('');
      setStatus('');
      return;
    }
    setResult(activeItem.review?.result ?? '');
    setComment(activeItem.review?.comment ?? '');
    setStatus(activeItem.review?.status ?? '');
  }, [activeItem]);

  const handleSubmit = (action: 'draft' | 'send') => {
    if (!activeItem) return;
    setIsSaving(true);
    submitAdminSelfAssessmentCapReview({
      capId: activeItem.id,
      result: result.trim() ? result : undefined,
      comment: comment.trim() ? comment : undefined,
      status: status || undefined,
      action,
    })
      .then(() => {
        toast({
          title: action === 'send' ? 'Review CAP dikirim' : 'Review CAP tersimpan',
          description:
            action === 'send'
              ? 'Review CAP berhasil dikirim ke user.'
              : 'Review CAP disimpan sebagai draft.',
        });
        loadItems();
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal mengirim review',
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
                Admin / CAP
              </p>
              <h1 className="text-lg font-semibold text-slate-800">Review CAP</h1>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/admin/self-assessment-cap-reviews')}
          >
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
        </header>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.05fr_1fr]">
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
            <div className="overflow-hidden divide-y rounded-xl border border-slate-200">
              {isLoading ? (
                <div className="px-3 py-4 text-sm text-slate-500">Memuat data...</div>
              ) : !detail || detail.caps.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">
                  Tidak ada CAP yang dikirim.
                </div>
              ) : (
                detail.caps.map((item) => {
                  const isSent = Boolean(item.review?.reviewedAt);
                  const isDraft = Boolean(item.review) && !isSent;
                  return (
                  <button
                    key={item.id}
                    type="button"
                    className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition ${
                      isSent
                        ? 'bg-emerald-50 text-slate-900 hover:bg-amber-300 dark:bg-emerald-900/30 dark:text-slate-100 dark:hover:bg-amber-500/60'
                        : isDraft
                        ? 'bg-amber-50 text-slate-900 hover:bg-amber-300 dark:bg-amber-900/30 dark:text-slate-100 dark:hover:bg-amber-500/60'
                        : activeCapId === item.id
                        ? 'bg-blue-100 text-slate-900 dark:bg-blue-900/40 dark:text-slate-100'
                        : 'text-slate-700 hover:bg-amber-300 dark:text-slate-200 dark:hover:bg-amber-500/60'
                    }`}
                    onClick={() => setActiveCapId(item.id)}
                  >
                    <span className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {item.questionCode ?? '-'}
                    </span>
                    <span className="flex-1">{item.questionText || '-'}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        isSent
                          ? 'bg-emerald-100 text-emerald-900'
                          : isDraft
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isSent ? 'Dikirim' : isDraft ? 'Draft' : 'Baru'}
                    </span>
                  </button>
                  );
                })
              )}
            </div>
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
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-900">
                      {activeItem.selfAssessmentReview?.status ?? 'Not Satisfactory'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700">Penyusunan CAP</div>
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
              <div className="text-sm font-semibold text-slate-700">
                Hasil Review CAP
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Result</label>
                  <input
                    value={result}
                    onChange={(event) => setResult(event.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Comment</label>
                  <Textarea
                    rows={3}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Status</label>
                  <select
                    className="h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {CAP_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {activeItem?.review?.reviewedAt ? (
                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Reviewed By</div>
                      <div>{activeItem.review?.reviewedBy?.name ?? '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500">Reviewed At</div>
                      <div>{activeItem.review?.reviewedAt ?? '-'}</div>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSubmit('draft')}
                    disabled={!activeItem || isSaving}
                  >
                    Simpan Draft
                  </Button>
                  <Button
                    className="bg-blue-500 text-white hover:bg-blue-600"
                    onClick={() => handleSubmit('send')}
                    disabled={!activeItem || isSaving}
                  >
                    Kirim Review
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
