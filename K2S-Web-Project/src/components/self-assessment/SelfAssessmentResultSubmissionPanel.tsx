import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

type ResultFile = {
  id: string;
  name: string;
  url: string;
};

type SelfAssessmentResultSubmissionPanelProps = {
  isResultComplete: boolean;
  finalizeStatus: 'interim' | 'final';
  onFinalizeStatusChange: (value: 'interim' | 'final') => void;
  fileInputRef: React.Ref<HTMLInputElement>;
  onFilesChange: (files: File[]) => void;
  resultFiles: ResultFile[];
  resolveUrl: (url: string) => string;
  isDeletingResultFile: boolean;
  onDeleteResultFile: (fileId: string) => void;
  forceSendResult: boolean;
  onForceSendResultChange: (value: boolean) => void;
  onSendResult: () => void;
  isSaving: boolean;
};

export function SelfAssessmentResultSubmissionPanel({
  isResultComplete,
  finalizeStatus,
  onFinalizeStatusChange,
  fileInputRef,
  onFilesChange,
  resultFiles,
  resolveUrl,
  isDeletingResultFile,
  onDeleteResultFile,
  forceSendResult,
  onForceSendResultChange,
  onSendResult,
  isSaving,
}: SelfAssessmentResultSubmissionPanelProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
      <div className="text-sm font-semibold text-slate-700">
        Pengiriman Document Final Hasil Audit
      </div>
      {!isResultComplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Hasil audit belum lengkap. Centang opsi di bawah jika ingin tetap mengirim.
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
              onFinalizeStatusChange(event.target.value === 'final' ? 'final' : 'interim')
            }
            disabled={!isResultComplete && !forceSendResult}
          >
            <option value="interim">Interim</option>
            <option value="final">Final</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">
            Upload Document <span className="font-normal text-slate-400">(opsional)</span>
          </label>
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
            onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
            disabled={!isResultComplete && !forceSendResult}
          />
        </div>
      </div>
      {resultFiles.length ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
          <div className="mb-2 font-semibold text-slate-700">File tersimpan</div>
          <div className="space-y-2">
            {resultFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-2">
                <a
                  href={resolveUrl(file.url)}
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
                  onClick={() => onDeleteResultFile(file.id)}
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
          onCheckedChange={(checked) => onForceSendResultChange(checked === true)}
        />
        <span>Kirim hasil walaupun tidak lengkap.</span>
      </label>
      {forceSendResult && (
        <div className="text-xs text-slate-500">
          Dengan mencentang box ini maka hasil akan tetap dikirim walaupun user belum
          mengirim semua self assessment atau admin belum mereview semua self
          assessment.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="bg-blue-500 text-white hover:bg-blue-600"
          onClick={onSendResult}
          disabled={isSaving || (!isResultComplete && !forceSendResult)}
        >
          Kirim Hasil
        </Button>
        <div className="text-xs text-slate-500">
          Format: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, ZIP.
        </div>
      </div>
    </div>
  );
}
