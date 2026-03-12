export const QUESTION_SECTION_LABELS: Record<string, string> = {
  A: 'ORGANISASI',
  B: 'PROSEDUR',
  C: 'PERSONEL',
};

export const formatMonitoringDateTime = (value?: string | null) => {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 19);
};

export const toDisplayValue = (value?: string | null) => {
  if (!value) return '-';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '-';
};

export const parseEvidenceReferenceList = (value?: string | null) => {
  const raw = (value ?? '').trim();
  if (!raw) return [] as string[];

  const filePattern =
    /[A-Za-z0-9_\-. ()]+?\.(?:jpg|jpeg|png|pdf|doc|docx|xls|xlsx|mp3|mp4|zip)/gi;
  const matched = raw.match(filePattern);
  if (matched && matched.length > 0) {
    return matched.map((item) => item.trim()).filter(Boolean);
  }

  return raw
    .split(/\r?\n|,|;|\|/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const resolveTime = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const resolveDetailScope = (
  scope?: string | null
): 'audit' | 'monitoring' | 'inspeksi' | 'surveillance' => {
  const normalized = (scope ?? '').toLowerCase();
  if (
    normalized === 'audit' ||
    normalized === 'monitoring' ||
    normalized === 'inspeksi' ||
    normalized === 'surveillance'
  ) {
    return normalized;
  }
  return 'monitoring';
};

export const resolveQuestionSection = (questionCode?: string | null) => {
  const normalized = (questionCode ?? '').trim().toUpperCase();
  const match = normalized.match(/^([A-Z])/);
  return match?.[1] ?? '#';
};

export const toReviewedBadgeLabel = (value?: string | null) => {
  if (!value) return 'Reviewed';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Reviewed';
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `Reviewed ${day}/${month}/${year}`;
};

export const isNotSatisfactoryStatus = (value?: string | null) => {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
  return normalized === 'not satisfactory';
};

export const resolveQuestionRowClass = (isClosed: boolean, isActive: boolean) => {
  const activeBlueRow =
    'bg-blue-100 text-slate-900 dark:bg-blue-900/40 dark:text-slate-100';
  const neutralHoverRow =
    'bg-white text-slate-900 hover:bg-amber-300 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-amber-500/60';
  const alertRow =
    'bg-red-50 text-slate-900 hover:bg-amber-300 dark:bg-red-900/25 dark:text-slate-100 dark:hover:bg-amber-500/60';
  if (isClosed) {
    return isActive ? `${activeBlueRow} font-semibold` : neutralHoverRow;
  }
  return isActive ? `${alertRow} font-semibold` : alertRow;
};
