import { useMemo, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { calculateDnpQuestionSimilarity } from '@/lib/selfAssessmentDnpMatching';
import type { SelfAssessmentExportDnpCompareSnapshot } from '@/lib/selfAssessment';

const TOP_DNP_MATCH_CANDIDATES = 3;

export type DnpQuestionMatchCandidate = {
  id: string;
  questionCode: string;
  questionText: string;
  reference?: string | null;
  similarity: number;
};

type DnpSimilarityPairCandidate = DnpQuestionMatchCandidate & {
  answerId: string;
  localQuestionCode: string;
  localQuestionText: string;
};

export type SelectedDnpMatch = DnpQuestionMatchCandidate & {
  answerId: string;
  localQuestionCode: string;
  localQuestionText: string;
};

type DnpAnswerSelectionTarget = {
  id: string;
  questionCode: string;
  questionText: string;
  evidence: Array<unknown>;
};

type UseDnpMatchSelectionParams = {
  answers: DnpAnswerSelectionTarget[];
  compareSnapshot: SelfAssessmentExportDnpCompareSnapshot | null;
  threshold: number;
  isImportMode: boolean;
  persistMatches: (
    nextMatches: Record<string, SelectedDnpMatch>,
    options?: { silent?: boolean }
  ) => Promise<void>;
};

export const restoreSelectedDnpMatches = (
  compareSnapshot: SelfAssessmentExportDnpCompareSnapshot | null | undefined
) =>
  Object.fromEntries(
    (compareSnapshot?.selectedMatches ?? [])
      .filter((item) => item.answerId && item.dnpSnapshotItemId)
      .map((item) => [
        item.answerId,
        {
          id: item.dnpSnapshotItemId,
          questionCode: item.dnpQuestionCode ?? '-',
          questionText: item.dnpQuestionText ?? '',
          reference: item.dnpReference ?? '',
          similarity: item.similarity ?? 0,
          answerId: item.answerId,
          localQuestionCode: item.localQuestionCode ?? '',
          localQuestionText: item.localQuestionText ?? '',
        },
      ])
  ) as Record<string, SelectedDnpMatch>;

export function useDnpMatchSelection({
  answers,
  compareSnapshot,
  threshold,
  isImportMode,
  persistMatches,
}: UseDnpMatchSelectionParams) {
  const [selectedDnpMatches, setSelectedDnpMatches] = useState<
    Record<string, SelectedDnpMatch>
  >({});
  const [collapsedDnpMatches, setCollapsedDnpMatches] = useState<
    Record<string, boolean>
  >({});

  const dnpMatchesByAnswerId = useMemo(() => {
    if (!answers.length || !compareSnapshot?.items.length) {
      return {} as Record<string, DnpQuestionMatchCandidate[]>;
    }

    return answers.reduce<Record<string, DnpQuestionMatchCandidate[]>>(
      (accumulator, answer) => {
        const matches = compareSnapshot.items
          .map((item) => ({
            id: item.id,
            questionCode: item.questionCode ?? '-',
            questionText: item.questionText ?? '',
            reference: item.reference ?? '',
            similarity: calculateDnpQuestionSimilarity(
              answer.questionText,
              item.questionText ?? ''
            ),
          }))
          .filter((item) => item.similarity > 0)
          .sort((left, right) => right.similarity - left.similarity)
          .slice(0, TOP_DNP_MATCH_CANDIDATES);

        accumulator[answer.id] = matches;
        return accumulator;
      },
      {}
    );
  }, [answers, compareSnapshot?.items]);

  const autoPairCandidates = useMemo(() => {
    if (!answers.length || !compareSnapshot?.items.length) {
      return [] as DnpSimilarityPairCandidate[];
    }

    return answers
      .flatMap((answer) =>
        compareSnapshot.items.map((item) => ({
          id: item.id,
          questionCode: item.questionCode ?? '-',
          questionText: item.questionText ?? '',
          reference: item.reference ?? '',
          similarity: calculateDnpQuestionSimilarity(
            answer.questionText,
            item.questionText ?? ''
          ),
          answerId: answer.id,
          localQuestionCode: answer.questionCode,
          localQuestionText: answer.questionText,
        }))
      )
      .filter((item) => item.similarity >= threshold)
      .sort((left, right) => right.similarity - left.similarity);
  }, [answers, compareSnapshot?.items, threshold]);

  const matchedAnswerCount = useMemo(
    () =>
      answers.filter(
        (answer) =>
          (dnpMatchesByAnswerId[answer.id]?.[0]?.similarity ?? 0) >= threshold
      ).length,
    [answers, dnpMatchesByAnswerId, threshold]
  );

  const totalSelectedEvidenceCount = useMemo(
    () =>
      answers.reduce((total, answer) => {
        if (!selectedDnpMatches[answer.id]) {
          return total;
        }
        return total + answer.evidence.length;
      }, 0),
    [answers, selectedDnpMatches]
  );

  const syncSelectedMatches = (restoredMatches: Record<string, SelectedDnpMatch>) => {
    setSelectedDnpMatches(restoredMatches);
    setCollapsedDnpMatches(
      Object.fromEntries(Object.keys(restoredMatches).map((key) => [key, true]))
    );
  };

  const toggleDnpMatchCollapse = (answerId: string) => {
    setCollapsedDnpMatches((prev) => ({
      ...prev,
      [answerId]: !prev[answerId],
    }));
  };

  const chooseDnpMatch = async (
    answer: DnpAnswerSelectionTarget,
    match: DnpQuestionMatchCandidate
  ) => {
    const previousMatch = selectedDnpMatches[answer.id];
    const nextMatches = {
      ...selectedDnpMatches,
      [answer.id]: {
        ...match,
        answerId: answer.id,
        localQuestionCode: answer.questionCode,
        localQuestionText: answer.questionText,
      },
    };
    setSelectedDnpMatches(nextMatches);
    setCollapsedDnpMatches((prev) => ({
      ...prev,
      [answer.id]: true,
    }));
    try {
      await persistMatches(nextMatches, { silent: true });
      toast({
        title: isImportMode ? 'Sumber import dipilih' : 'Target export dipilih',
        description: isImportMode
          ? `${answer.questionCode} akan mengambil jawaban dari PQ DNP ${match.questionCode}.`
          : `${answer.questionCode} diarahkan ke PQ DNP ${match.questionCode}.`,
      });
    } catch (error) {
      setSelectedDnpMatches((prev) => {
        const fallback = { ...prev };
        if (previousMatch) {
          fallback[answer.id] = previousMatch;
        } else {
          delete fallback[answer.id];
        }
        return fallback;
      });
      setCollapsedDnpMatches((prev) => ({
        ...prev,
        [answer.id]: Boolean(previousMatch),
      }));
      toast({
        title: isImportMode
          ? 'Gagal menyimpan sumber import'
          : 'Gagal menyimpan target export',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    }
  };

  const clearDnpMatch = async (answerId: string) => {
    const previousMatch = selectedDnpMatches[answerId];
    const nextMatches = { ...selectedDnpMatches };
    delete nextMatches[answerId];

    setSelectedDnpMatches(nextMatches);
    setCollapsedDnpMatches((prev) => ({
      ...prev,
      [answerId]: false,
    }));

    try {
      await persistMatches(nextMatches, { silent: true });
      toast({
        title: isImportMode ? 'Pilihan sumber dibatalkan' : 'Pilihan target dibatalkan',
        description: isImportMode
          ? 'Pertanyaan lokal ini tidak lagi mengambil jawaban dari PQ DNP.'
          : 'Pertanyaan lokal ini tidak lagi diarahkan ke PQ DNP.',
      });
    } catch (error) {
      setSelectedDnpMatches((prev) => ({
        ...prev,
        ...(previousMatch ? { [answerId]: previousMatch } : {}),
      }));
      setCollapsedDnpMatches((prev) => ({
        ...prev,
        [answerId]: true,
      }));
      toast({
        title: isImportMode
          ? 'Gagal membatalkan sumber import'
          : 'Gagal membatalkan target export',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    }
  };

  const clearAllDnpMatches = async () => {
    if (Object.keys(selectedDnpMatches).length === 0) {
      return;
    }

    const previousMatches = selectedDnpMatches;
    const previousCollapsedMatches = collapsedDnpMatches;

    setSelectedDnpMatches({});
    setCollapsedDnpMatches({});

    try {
      await persistMatches({}, { silent: true });
      toast({
        title: isImportMode ? 'Semua sumber import dibatalkan' : 'Semua target dibatalkan',
        description: isImportMode
          ? 'Seluruh pairing import DNP untuk area ini berhasil dikosongkan.'
          : 'Seluruh pairing export DNP untuk area ini berhasil dikosongkan.',
      });
    } catch (error) {
      setSelectedDnpMatches(previousMatches);
      setCollapsedDnpMatches(previousCollapsedMatches);
      toast({
        title: isImportMode
          ? 'Gagal mengosongkan sumber import'
          : 'Gagal mengosongkan target export',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    }
  };

  const autoPairDnpMatches = async () => {
    if (!answers.length || !compareSnapshot?.items.length) {
      return;
    }

    const previousMatches = selectedDnpMatches;
    const previousCollapsedMatches = collapsedDnpMatches;
    const nextMatches: Record<string, SelectedDnpMatch> = { ...previousMatches };
    const usedAnswerIds = new Set<string>(Object.keys(previousMatches));
    const usedDnpItemIds = new Set<string>(
      Object.values(previousMatches).map((match) => match.id)
    );

    for (const candidate of autoPairCandidates) {
      if (usedAnswerIds.has(candidate.answerId) || usedDnpItemIds.has(candidate.id)) {
        continue;
      }

      usedAnswerIds.add(candidate.answerId);
      usedDnpItemIds.add(candidate.id);
      nextMatches[candidate.answerId] = {
        id: candidate.id,
        questionCode: candidate.questionCode,
        questionText: candidate.questionText,
        reference: candidate.reference ?? '',
        similarity: candidate.similarity,
        answerId: candidate.answerId,
        localQuestionCode: candidate.localQuestionCode,
        localQuestionText: candidate.localQuestionText,
      };

      if (usedAnswerIds.size >= answers.length) {
        break;
      }
    }

    if (Object.keys(nextMatches).length === 0) {
      toast({
        title: 'Auto pairing tidak menemukan kandidat',
        description: `Tidak ada pasangan lokal-DNP yang memenuhi threshold ${threshold}%.`,
      });
      return;
    }

    const addedMatchCount =
      Object.keys(nextMatches).length - Object.keys(previousMatches).length;
    if (addedMatchCount <= 0) {
      toast({
        title: 'Auto pairing tidak menambah mapping baru',
        description:
          'Semua kandidat yang memenuhi threshold sudah dipakai pada pairing yang ada.',
      });
      return;
    }

    setSelectedDnpMatches(nextMatches);
    setCollapsedDnpMatches({
      ...previousCollapsedMatches,
      ...Object.fromEntries(Object.keys(nextMatches).map((key) => [key, true])),
    });

    try {
      await persistMatches(nextMatches, { silent: true });
      toast({
        title: isImportMode ? 'Auto pairing import selesai' : 'Auto pairing selesai',
        description: `${addedMatchCount} pairing baru ditambahkan. Total pairing aktif ${Object.keys(nextMatches).length} dari ${answers.length} pertanyaan lokal.`,
      });
    } catch (error) {
      setSelectedDnpMatches(previousMatches);
      setCollapsedDnpMatches(previousCollapsedMatches);
      toast({
        title: 'Gagal menyimpan auto pairing',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan.',
      });
    }
  };

  return {
    selectedDnpMatches,
    collapsedDnpMatches,
    dnpMatchesByAnswerId,
    matchedAnswerCount,
    totalSelectedEvidenceCount,
    syncSelectedMatches,
    autoPairDnpMatches,
    chooseDnpMatch,
    toggleDnpMatchCollapse,
    clearDnpMatch,
    clearAllDnpMatches,
  };
}
