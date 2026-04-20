import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ReviewAnswer = {
  id: string;
  questionCode: string;
  questionText: string;
  comment: string | null;
  evidence: Array<{ id: string; name: string; url: string }>;
  review: {
    reviewer?: { name?: string | null } | null;
    sentAt?: string | null;
  } | null;
};

type ReviewInputState = {
  status: string;
  severity: string;
  probability: string;
  resume: string;
  description: string;
  finding: string;
  recommendations: string;
  remark: string;
};

type SelfAssessmentReviewDetailPanelProps = {
  activeAnswer: ReviewAnswer;
  reviewLabel: string;
  reviewInput: ReviewInputState;
  sendMode: 'finalize' | 'allow';
  onSendModeChange: (value: 'finalize' | 'allow') => void;
  onReviewChange: (value: Partial<ReviewInputState>) => void;
  onSubmitDraft: () => void;
  onSubmitSend: () => void;
  isSaving: boolean;
  resolveUrl: (url: string) => string;
};

export function SelfAssessmentReviewDetailPanel({
  activeAnswer,
  reviewLabel,
  reviewInput,
  sendMode,
  onSendModeChange,
  onReviewChange,
  onSubmitDraft,
  onSubmitSend,
  isSaving,
  resolveUrl,
}: SelfAssessmentReviewDetailPanelProps) {
  return (
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
                    href={resolveUrl(item.url)}
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
              value={reviewInput.status}
              onChange={(event) => onReviewChange({ status: event.target.value })}
            >
              <option value="Satisfactory">Satisfactory</option>
              <option value="Not Satisfactory">Not Satisfactory</option>
              <option value="Not Applicable">Not Applicable</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Severity</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={reviewInput.severity}
              onChange={(event) => onReviewChange({ severity: event.target.value })}
            >
              <option value="">-</option>
              <option value="Minor">Minor</option>
              <option value="Major">Major</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Probability</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={reviewInput.probability}
              onChange={(event) => onReviewChange({ probability: event.target.value })}
            >
              <option value="">-</option>
              <option value="Rare">Rare</option>
              <option value="Occasional">Occasional</option>
              <option value="Frequent">Frequent</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Resume</label>
            <Input
              value={reviewInput.resume}
              onChange={(event) => onReviewChange({ resume: event.target.value })}
              placeholder="Ringkasan"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Description</label>
            <Textarea
              rows={3}
              value={reviewInput.description}
              onChange={(event) => onReviewChange({ description: event.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Finding</label>
            <Textarea
              rows={3}
              value={reviewInput.finding}
              onChange={(event) => onReviewChange({ finding: event.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">
              Recommendations
            </label>
            <Textarea
              rows={3}
              value={reviewInput.recommendations}
              onChange={(event) =>
                onReviewChange({ recommendations: event.target.value })
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Remark</label>
            <Textarea
              rows={3}
              value={reviewInput.remark}
              onChange={(event) => onReviewChange({ remark: event.target.value })}
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
            onSendModeChange(event.target.value === 'allow' ? 'allow' : 'finalize')
          }
        >
          <option value="finalize">Finalize</option>
          <option value="allow">Allow Reply</option>
        </select>
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onSubmitDraft} disabled={isSaving}>
          Simpan Draft
        </Button>
        <Button
          className="bg-blue-500 text-white hover:bg-blue-600"
          onClick={onSubmitSend}
          disabled={isSaving}
        >
          Kirim
        </Button>
      </div>
      <div className="grid gap-3 pt-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Review By</label>
          <Input value={activeAnswer.review?.reviewer?.name ?? '—'} disabled />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Review At</label>
          <Input value={activeAnswer.review?.sentAt ?? '—'} disabled />
        </div>
      </div>
    </>
  );
}
