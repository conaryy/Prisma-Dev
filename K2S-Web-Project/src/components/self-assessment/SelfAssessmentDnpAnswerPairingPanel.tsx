import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { getDnpMatchToneClass } from '@/lib/selfAssessmentDnpMatching';
import type {
  DnpQuestionMatchCandidate,
  SelectedDnpMatch,
} from '@/hooks/useDnpMatchSelection';

type PairingAnswer = {
  id: string;
  questionCode: string;
  questionText: string;
  evidence: Array<unknown>;
};

type ExportResult = {
  summary: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  results: Array<{
    answerId: string;
    localQuestionCode: string;
    dnpQuestionCode: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
    uploads?: Array<{
      evidenceId: string;
      fileName: string;
      status: 'success' | 'failed' | 'skipped';
      message: string;
    }>;
  }>;
};

type SelfAssessmentDnpAnswerPairingPanelProps = {
  activeAnswer: PairingAnswer;
  isImportMode: boolean;
  dnpMatchThreshold: number;
  activeBestMatch: DnpQuestionMatchCandidate | null;
  activeSelectedDnpMatch: SelectedDnpMatch | null;
  isActiveDnpMatchCollapsed: boolean;
  activeAnswerMatches: DnpQuestionMatchCandidate[];
  activeAnswerEvidenceCount: number;
  selectedMatchCount: number;
  totalSelectedEvidenceCount: number;
  skipDuplicateDnpFileNames: boolean;
  onSkipDuplicateDnpFileNamesChange: (value: boolean) => void;
  onToggleCollapse: () => void;
  onChooseMatch: (match: DnpQuestionMatchCandidate) => void;
  onClearMatch: () => void;
  onRunSingleExport: () => void;
  onRunBulkExport: () => void;
  onRunSingleInject: () => void;
  onRunBulkInject: () => void;
  isExportingToDnp: boolean;
  isInjectingFromDnp: boolean;
  exportResult: ExportResult | null;
};

export function SelfAssessmentDnpAnswerPairingPanel({
  activeAnswer,
  isImportMode,
  dnpMatchThreshold,
  activeBestMatch,
  activeSelectedDnpMatch,
  isActiveDnpMatchCollapsed,
  activeAnswerMatches,
  activeAnswerEvidenceCount,
  selectedMatchCount,
  totalSelectedEvidenceCount,
  skipDuplicateDnpFileNames,
  onSkipDuplicateDnpFileNamesChange,
  onToggleCollapse,
  onChooseMatch,
  onClearMatch,
  onRunSingleExport,
  onRunBulkExport,
  onRunSingleInject,
  onRunBulkInject,
  isExportingToDnp,
  isInjectingFromDnp,
  exportResult,
}: SelfAssessmentDnpAnswerPairingPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-700">
            {isImportMode
              ? 'Pairing Pertanyaan Lokal vs DNP'
              : 'Compare Pertanyaan Lokal vs DNP'}
          </div>
          <div className="text-xs text-slate-500">
            {isImportMode
              ? 'Pilih sumber jawaban DNP yang akan diinject ke pertanyaan lokal.'
              : 'Penyamaan berbasis similarity isi pertanyaan.'}
          </div>
        </div>
        {activeBestMatch ? (
          <div className="flex flex-wrap items-center gap-2">
            {activeSelectedDnpMatch ? (
              <span className="rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200">
                {isImportMode ? 'Sumber dipilih' : 'Dipilih'}:{' '}
                {activeSelectedDnpMatch.questionCode}
              </span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${getDnpMatchToneClass(
                activeBestMatch.similarity,
                dnpMatchThreshold
              )}`}
            >
              Best match {activeBestMatch.similarity}%
            </span>
          </div>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Belum ada kandidat
          </span>
        )}
      </div>
      {activeSelectedDnpMatch ? (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-700">
                {isImportMode ? 'Sumber jawaban DNP dipilih' : 'Target export dipilih'}
              </div>
              <div className="text-xs text-slate-500">
                {isImportMode
                  ? `${activeAnswer.questionCode} akan mengambil jawaban dari PQ DNP ${activeSelectedDnpMatch.questionCode}.`
                  : `${activeAnswer.questionCode} akan diarahkan ke PQ DNP ${activeSelectedDnpMatch.questionCode}.`}
              </div>
              {isImportMode ? null : (
                <div className="mt-1 text-xs text-slate-500">
                  Evidence lokal yang ikut dikirim: {activeAnswerEvidenceCount} file.
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isImportMode ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-500 text-white hover:bg-blue-600"
                  onClick={onRunSingleInject}
                  disabled={isInjectingFromDnp}
                >
                  {isInjectingFromDnp
                    ? 'Menginject...'
                    : `Inject Pertanyaan Ini (${activeAnswer.questionCode})`}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-500 text-white hover:bg-blue-600"
                  onClick={onRunSingleExport}
                  disabled={isExportingToDnp}
                >
                  {isExportingToDnp
                    ? 'Mengirim...'
                    : `Export Pertanyaan Ini (${activeAnswer.questionCode})`}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleCollapse}
              >
                {isActiveDnpMatchCollapsed ? 'Open List' : 'Minimize'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {!activeSelectedDnpMatch || !isActiveDnpMatchCollapsed ? (
        <div className="mt-3 space-y-3">
          {activeAnswerMatches.length > 0 ? (
            activeAnswerMatches.map((match, index) => {
              const isQualified = match.similarity >= dnpMatchThreshold;
              const isSelected = activeSelectedDnpMatch?.id === match.id;
              return (
                <div
                  key={match.id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        Kandidat {index + 1}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getDnpMatchToneClass(
                          match.similarity,
                          dnpMatchThreshold
                        )}`}
                      >
                        {match.similarity}%
                      </span>
                      <span className="text-xs text-slate-500">
                        {isQualified
                          ? isImportMode
                            ? 'Layak dipakai sebagai sumber import'
                            : 'Layak dipertimbangkan untuk export'
                          : 'Masih di bawah ambang match'}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? 'outline' : 'default'}
                      className={
                        isSelected ? undefined : 'bg-blue-500 text-white hover:bg-blue-600'
                      }
                      onClick={() => {
                        if (isSelected) {
                          onClearMatch();
                          return;
                        }
                        onChooseMatch(match);
                      }}
                    >
                      {isSelected
                        ? 'Batalkan Pilihan'
                        : isImportMode
                        ? 'Pilih / Ganti Sumber'
                        : 'Pilih / Ganti Target'}
                    </Button>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-500">
                    {match.questionCode}
                  </div>
                  <div className="text-sm text-slate-700">{match.questionText || '-'}</div>
                  {match.reference ? (
                    <div className="mt-2 text-xs text-slate-500">
                      Referensi DNP: {match.reference}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
              Belum ada pertanyaan DNP untuk dibandingkan pada area ini.
            </div>
          )}
        </div>
      ) : null}
      {selectedMatchCount > 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
          <label className="mb-3 flex items-start gap-2 text-xs text-slate-600">
            <Checkbox
              checked={skipDuplicateDnpFileNames}
              onCheckedChange={(checked) =>
                onSkipDuplicateDnpFileNamesChange(checked === true)
              }
            />
            <span>
              Skip upload file bila nama file yang sama sudah ada di target DNP.
              Nonaktifkan opsi ini jika admin ingin semua file tetap diupload.
            </span>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-700">
                {isImportMode
                  ? 'Inject Semua Pairing Area Ini'
                  : 'Export Semua Pairing Area Ini'}
              </div>
              <div className="text-xs text-slate-500">
                {isImportMode
                  ? 'Ambil semua jawaban DNP dari pairing terpilih ke jawaban lokal.'
                  : 'Kirim semua pertanyaan lokal yang sudah dipasangkan ke draft DNP.'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Pairing terpilih: {selectedMatchCount}
                {isImportMode
                  ? ''
                  : ` • Evidence lokal yang ikut dikirim: ${totalSelectedEvidenceCount} file.`}
              </div>
            </div>
            {isImportMode ? (
              <Button
                type="button"
                size="sm"
                className="bg-blue-500 text-white hover:bg-blue-600"
                onClick={onRunBulkInject}
                disabled={isInjectingFromDnp}
              >
                {isInjectingFromDnp
                  ? 'Menginject semua...'
                  : `Inject Semua Pairing (${selectedMatchCount})`}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-blue-500 text-white hover:bg-blue-600"
                onClick={onRunBulkExport}
                disabled={isExportingToDnp}
              >
                {isExportingToDnp
                  ? 'Mengirim semua...'
                  : `Export Semua Pairing (${selectedMatchCount})`}
              </Button>
            )}
          </div>
        </div>
      ) : null}
      {!isImportMode && exportResult ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-800 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-100">
              Total {exportResult.summary.total}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
              Berhasil {exportResult.summary.success}
            </span>
            <span className="rounded-full border border-red-200 bg-red-100 px-2 py-1 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200">
              Gagal {exportResult.summary.failed}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
              Dilewati {exportResult.summary.skipped}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {exportResult.results.map((item) => (
              <div
                key={`${item.answerId}-${item.dnpQuestionCode}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700">
                    {item.localQuestionCode} {'->'} {item.dnpQuestionCode || '-'}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-1 font-semibold ${
                      item.status === 'success'
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200'
                        : item.status === 'failed'
                        ? 'border-red-200 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200'
                        : 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-1 text-slate-500">{item.message}</div>
                {item.uploads && item.uploads.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {item.uploads.map((upload) => (
                      <div
                        key={upload.evidenceId}
                        className="rounded-md bg-white px-2 py-2 text-[11px]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-700">
                            File: {upload.fileName}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-1 font-semibold ${
                              upload.status === 'success'
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200'
                                : upload.status === 'failed'
                                ? 'border-red-200 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200'
                                : 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200'
                            }`}
                          >
                            {upload.status}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-500">{upload.message}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
