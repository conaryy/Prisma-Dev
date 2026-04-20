import type { ReactNode } from 'react';
import { UploadCloud } from 'lucide-react';
import { FormField, FormSection } from '@/components/shared/Form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type AssessmentAnswer = {
  id: string;
  questionText: string;
  reference: string | null;
  evidence: Array<{ id: string; name: string; url: string }>;
};

type AssessmentInputState = {
  status: string;
  comment: string;
  evidenceNote: string;
};

type SelfAssessmentAssessmentEditorPanelProps = {
  activeAnswer: AssessmentAnswer;
  activeAssessmentInput: AssessmentInputState;
  isAssessmentInputDisabled: boolean;
  isAssessmentLocked: boolean;
  canOverrideAssessmentLock: boolean;
  isUploadingEvidence: boolean;
  isSaving: boolean;
  evidenceError: string | null;
  resolveUrl: (url: string) => string;
  onAssessmentChange: (value: Partial<AssessmentInputState>) => void;
  onAssessmentSave: () => void;
  onEvidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEvidenceDelete: (evidenceId: string) => void;
  dnpPairingPanel?: ReactNode;
};

export function SelfAssessmentAssessmentEditorPanel({
  activeAnswer,
  activeAssessmentInput,
  isAssessmentInputDisabled,
  isAssessmentLocked,
  canOverrideAssessmentLock,
  isUploadingEvidence,
  isSaving,
  evidenceError,
  resolveUrl,
  onAssessmentChange,
  onAssessmentSave,
  onEvidenceUpload,
  onEvidenceDelete,
  dnpPairingPanel,
}: SelfAssessmentAssessmentEditorPanelProps) {
  return (
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
          isAssessmentInputDisabled ? 'opacity-60' : ''
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
            isAssessmentInputDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,.mp3,.mp4"
          onChange={onEvidenceUpload}
          disabled={isAssessmentInputDisabled || isUploadingEvidence || isSaving}
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
                  href={resolveUrl(item.url)}
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
                  disabled={isAssessmentInputDisabled || isUploadingEvidence || isSaving}
                  onClick={() => onEvidenceDelete(item.id)}
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
        *File yang diperbolehkan: JPG, JPEG, PDF, DOCX, PNG, MP3, MP4, XLSX
        <br />
        *Max size : 20MB
      </div>
      {evidenceError ? <div className="text-xs text-red-500">{evidenceError}</div> : null}
      {isAssessmentLocked ? (
        <div
          className={`rounded-xl px-3 py-2 text-xs ${
            canOverrideAssessmentLock
              ? 'border border-blue-200 bg-blue-50 text-blue-700'
              : 'border border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {canOverrideAssessmentLock
            ? 'Jawaban sudah difinalisasi, tetapi admin masih dapat override perubahan lokal dari menu Export DNP.'
            : 'Jawaban sudah difinalisasi dan tidak bisa diubah.'}
        </div>
      ) : null}

      <FormSection title="Data Assessment">
        <div className="grid gap-4">
          {dnpPairingPanel}
          <FormField label="Protocol Question">
            <Textarea rows={3} value={activeAnswer.questionText} disabled />
          </FormField>
          <FormField label="Referensi Regulasi">
            <Textarea rows={2} value={activeAnswer.reference ?? ''} disabled />
          </FormField>
          <FormField label="Status of Implementation" required>
            <select
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={activeAssessmentInput.status}
              onChange={(event) => onAssessmentChange({ status: event.target.value })}
              disabled={isAssessmentInputDisabled}
            >
              <option value="Satisfactory">Satisfactory</option>
              <option value="Not Satisfactory">Not Satisfactory</option>
              <option value="Not Applicable">Not Applicable</option>
            </select>
          </FormField>
          <FormField label="Comment">
            <Textarea
              rows={3}
              value={activeAssessmentInput.comment}
              onChange={(event) => onAssessmentChange({ comment: event.target.value })}
              disabled={isAssessmentInputDisabled}
            />
          </FormField>
          <FormField label="Evidence Notes">
            <Textarea
              rows={3}
              value={activeAssessmentInput.evidenceNote}
              onChange={(event) =>
                onAssessmentChange({ evidenceNote: event.target.value })
              }
              disabled={isAssessmentInputDisabled}
            />
          </FormField>
          <div className="text-xs text-red-500">Kolom dengan tanda bintang wajib diisi.</div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={onAssessmentSave}
              disabled={isAssessmentInputDisabled || isSaving || isUploadingEvidence}
            >
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </FormSection>
    </>
  );
}
