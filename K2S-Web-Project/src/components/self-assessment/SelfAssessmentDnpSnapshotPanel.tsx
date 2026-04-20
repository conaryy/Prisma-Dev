import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  calculateDnpQuestionSimilarity,
  getDnpMatchToneClass,
} from '@/lib/selfAssessmentDnpMatching';
import type { SelfAssessmentExportDnpCompareSnapshot } from '@/lib/selfAssessment';
import type { SelectedDnpMatch } from '@/hooks/useDnpMatchSelection';

type SnapshotAnswer = {
  id: string;
  questionCode: string;
  questionText: string;
};

type SelfAssessmentDnpSnapshotPanelProps = {
  compareSnapshot: SelfAssessmentExportDnpCompareSnapshot;
  answers: SnapshotAnswer[];
  isAssessmentMode: boolean;
  isImportMode: boolean;
  dnpMatchThreshold: number;
  matchedAnswerCount: number;
  selectedDnpMatches: Record<string, SelectedDnpMatch>;
  includeDnpEvidenceOnInject: boolean;
  onIncludeDnpEvidenceOnInjectChange: (value: boolean) => void;
  onThresholdChange: (value: number) => void;
  onAutoPair: () => void;
  onClearAll: () => void;
  dnpQuestionPage: number;
  onDnpQuestionPageChange: (page: number) => void;
};

const QUESTION_ITEMS_PER_PAGE = 5;

export function SelfAssessmentDnpSnapshotPanel({
  compareSnapshot,
  answers,
  isAssessmentMode,
  isImportMode,
  dnpMatchThreshold,
  matchedAnswerCount,
  selectedDnpMatches,
  includeDnpEvidenceOnInject,
  onIncludeDnpEvidenceOnInjectChange,
  onThresholdChange,
  onAutoPair,
  onClearAll,
  dnpQuestionPage,
  onDnpQuestionPageChange,
}: SelfAssessmentDnpSnapshotPanelProps) {
  const totalDnpQuestionPages = Math.max(
    1,
    Math.ceil(compareSnapshot.items.length / QUESTION_ITEMS_PER_PAGE)
  );
  const safeDnpQuestionPage = Math.min(
    Math.max(dnpQuestionPage, 1),
    totalDnpQuestionPages
  );
  const dnpQuestionStart = (safeDnpQuestionPage - 1) * QUESTION_ITEMS_PER_PAGE;
  const paginatedDnpItems = compareSnapshot.items.slice(
    dnpQuestionStart,
    dnpQuestionStart + QUESTION_ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-700">Pertanyaan DNP</div>
          <div className="text-xs text-slate-500">
            Target: {compareSnapshot.fillArea || '-'} • Import:{' '}
            {compareSnapshot.importedAt || '-'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {compareSnapshot.items.length} item
          </span>
          {isAssessmentMode ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
              Match {matchedAnswerCount} / {answers.length}
            </span>
          ) : null}
        </div>
      </div>
      {isAssessmentMode || isImportMode ? (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">
              Threshold Kecocokan Pertanyaan
            </label>
            <input
              type="range"
              min={40}
              max={100}
              step={5}
              value={dnpMatchThreshold}
              onChange={(event) => onThresholdChange(Number(event.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="text-xs text-slate-500">
              Pertanyaan dianggap cocok bila similarity minimal{' '}
              <span className="font-semibold text-slate-700">
                {dnpMatchThreshold}%
              </span>
              .
            </div>
          </div>
          <div className="space-y-2">
            <div className="rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
              {isImportMode
                ? 'Auto pairing akan memilih sumber jawaban DNP dengan similarity terbesar untuk tiap pertanyaan lokal.'
                : 'Auto pairing akan mengambil similarity terbesar untuk tiap pertanyaan lokal.'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
                onClick={onAutoPair}
                disabled={!answers.length || !compareSnapshot.items.length}
              >
                {isImportMode
                  ? 'Pilih Otomatis Berdasarkan Threshold'
                  : 'Auto Pairing Berdasarkan Threshold'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-300"
                onClick={onClearAll}
                disabled={Object.keys(selectedDnpMatches).length === 0}
              >
                Unselect All
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              {isImportMode
                ? 'Setiap pertanyaan lokal akan dipasangkan ke satu sumber DNP terbaik dan item DNP tidak dipakai ganda.'
                : 'Maksimal pairing mengikuti jumlah pertanyaan lokal dan target DNP tidak dipakai ganda.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Data pertanyaan dari DNP sudah berhasil diambil dan disimpan sebagai snapshot untuk sesi ini.
        </div>
      )}
      {isImportMode ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <Checkbox
              checked={includeDnpEvidenceOnInject}
              onCheckedChange={(checked) =>
                onIncludeDnpEvidenceOnInjectChange(checked === true)
              }
            />
            <span>
              Ikutkan file evidence DNP saat inject. Maksimal 5 file per pertanyaan,
              file yang gagal akan dilewati tanpa membatalkan inject jawaban.
            </span>
          </label>
        </div>
      ) : null}
      {paginatedDnpItems.length > 0 ? (
        <div className="overflow-hidden divide-y rounded-xl border border-slate-200">
          {paginatedDnpItems.map((item) => {
            const bestLocalMatch = answers
              .map((answer) => ({
                answer,
                similarity: calculateDnpQuestionSimilarity(
                  answer.questionText,
                  item.questionText ?? ''
                ),
              }))
              .sort((left, right) => right.similarity - left.similarity)[0];
            const assignedLocalMatches = Object.values(selectedDnpMatches).filter(
              (match) => match.id === item.id
            );

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 bg-slate-50 px-3 py-3 text-sm"
              >
                <span className="mt-1 text-xs font-semibold text-slate-500">
                  {item.questionCode || '-'}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="text-slate-700">{item.questionText || '-'}</div>
                  {isAssessmentMode && assignedLocalMatches.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {assignedLocalMatches.map((match) => (
                        <span
                          key={`${item.id}-${match.answerId}`}
                          className="rounded-full border border-blue-200 bg-blue-100 px-2 py-1 font-semibold text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200"
                        >
                          Cocok dengan {match.localQuestionCode}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {bestLocalMatch ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-1 font-semibold ${getDnpMatchToneClass(
                          bestLocalMatch.similarity,
                          dnpMatchThreshold
                        )}`}
                      >
                        {bestLocalMatch.similarity}%
                      </span>
                      <span className="text-slate-500">
                        {isAssessmentMode
                          ? 'Kandidat lokal'
                          : 'Pertanyaan lokal terdekat'}
                        : {bestLocalMatch.answer.questionCode} -{' '}
                        {bestLocalMatch.answer.questionText}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-slate-500">
          Belum ada item pertanyaan DNP yang tersimpan.
        </div>
      )}
      {compareSnapshot.items.length > QUESTION_ITEMS_PER_PAGE ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Halaman {safeDnpQuestionPage} dari {totalDnpQuestionPages}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDnpQuestionPageChange(Math.max(1, safeDnpQuestionPage - 1))}
              disabled={safeDnpQuestionPage === 1}
            >
              Sebelumnya
            </Button>
            {Array.from({ length: totalDnpQuestionPages }, (_, index) => {
              const page = index + 1;
              const isActive = page === safeDnpQuestionPage;
              return (
                <Button
                  key={page}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={isActive ? 'bg-blue-500 text-white hover:bg-blue-600' : undefined}
                  onClick={() => onDnpQuestionPageChange(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onDnpQuestionPageChange(
                  Math.min(totalDnpQuestionPages, safeDnpQuestionPage + 1)
                )
              }
              disabled={safeDnpQuestionPage === totalDnpQuestionPages}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
