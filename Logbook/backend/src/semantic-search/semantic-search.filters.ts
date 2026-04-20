export type SemanticSearchFilters = {
  sourceType?: 'tower' | 'app' | 'teknik';
  startDate?: string;
  endDate?: string;
};

function isoDateToDateKey(isoDate?: string) {
  if (!isoDate) {
    return null;
  }

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return Number(`${match[1]}${match[2]}${match[3]}`);
}

export function normalizeExplicitFilters(explicitFilters: SemanticSearchFilters = {}) {
  const sourceType = explicitFilters.sourceType || undefined;
  const startDate = explicitFilters.startDate || undefined;
  const endDate = explicitFilters.endDate || undefined;

  return {
    sourceType,
    startDate,
    endDate,
    startDateKey: isoDateToDateKey(startDate),
    endDateKey: isoDateToDateKey(endDate),
  };
}

export function buildQdrantFilter(explicitFilters: SemanticSearchFilters = {}) {
  const parsed = normalizeExplicitFilters(explicitFilters);
  const must: Record<string, unknown>[] = [];

  if (parsed.sourceType) {
    must.push({
      key: 'source_type',
      match: { value: parsed.sourceType },
    });
  }

  if (parsed.startDateKey && parsed.endDateKey) {
    must.push({
      key: 'entry_date_key',
      range: {
        gte: parsed.startDateKey,
        lte: parsed.endDateKey,
      },
    });
  }

  return {
    parsed,
    filter: must.length > 0 ? { must } : undefined,
  };
}
