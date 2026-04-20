export function normalizeDnpQuestionForMatch(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\b[a-z]+\.\d+\b/g, ' ')
    .replace(/\b[a-z]+\b(?=\s*-\s*)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildDnpQuestionWordBigrams(value: string) {
  const words = value.split(' ').filter(Boolean);
  if (words.length <= 1) {
    return words;
  }

  const pairs: string[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    pairs.push(`${words[index]} ${words[index + 1]}`);
  }
  return pairs;
}

export function calculateDnpQuestionSimilarity(source: string, target: string) {
  const normalizedSource = normalizeDnpQuestionForMatch(source);
  const normalizedTarget = normalizeDnpQuestionForMatch(target);

  if (!normalizedSource || !normalizedTarget) {
    return 0;
  }

  if (normalizedSource === normalizedTarget) {
    return 100;
  }

  const sourceTokens = normalizedSource.split(' ').filter(Boolean);
  const targetTokens = normalizedTarget.split(' ').filter(Boolean);
  const sourceTokenSet = new Set(sourceTokens);
  const targetTokenSet = new Set(targetTokens);
  const commonTokenCount = [...sourceTokenSet].filter((token) =>
    targetTokenSet.has(token)
  ).length;
  const tokenScore =
    (2 * commonTokenCount) / (sourceTokenSet.size + targetTokenSet.size || 1);

  const sourceBigrams = buildDnpQuestionWordBigrams(normalizedSource);
  const targetBigrams = buildDnpQuestionWordBigrams(normalizedTarget);
  const sourceBigramSet = new Set(sourceBigrams);
  const targetBigramSet = new Set(targetBigrams);
  const commonBigramCount = [...sourceBigramSet].filter((token) =>
    targetBigramSet.has(token)
  ).length;
  const bigramScore =
    (2 * commonBigramCount) /
    (sourceBigramSet.size + targetBigramSet.size || 1);

  const coverageScore = sourceTokens.length
    ? commonTokenCount / sourceTokens.length
    : 0;

  const weightedScore =
    tokenScore * 0.5 + bigramScore * 0.35 + coverageScore * 0.15;

  return Math.max(0, Math.min(100, Math.round(weightedScore * 100)));
}

export function getDnpMatchToneClass(similarity: number, threshold: number) {
  if (similarity >= Math.max(threshold, 85)) {
    return 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200';
  }
  if (similarity >= threshold) {
    return 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200';
  }
  if (similarity >= Math.max(50, threshold - 10)) {
    return 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200';
  }
  return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200';
}
