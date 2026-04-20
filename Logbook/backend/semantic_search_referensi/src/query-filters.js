function isoDateToDateKey(isoDate) {
  if (!isoDate) {
    return null;
  }

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return Number(`${match[1]}${match[2]}${match[3]}`);
}

function normalizeExplicitFilters(explicitFilters = {}) {
  const sourceType = explicitFilters.sourceType || null;
  const startDate = explicitFilters.startDate || null;
  const endDate = explicitFilters.endDate || null;

  return {
    sourceType,
    startDate,
    endDate,
    startDateKey: isoDateToDateKey(startDate),
    endDateKey: isoDateToDateKey(endDate)
  };
}

function hasStructuredDateFilter(filters) {
  return Boolean(filters.startDate && filters.endDate);
}

function buildQdrantFilter(explicitFilters = {}) {
  const parsed = normalizeExplicitFilters(explicitFilters);
  const must = [];

  if (parsed.sourceType) {
    must.push({
      key: "source_type",
      match: { value: parsed.sourceType }
    });
  }

  if (parsed.startDateKey && parsed.endDateKey) {
    must.push({
      key: "entry_date_key",
      range: {
        gte: parsed.startDateKey,
        lte: parsed.endDateKey
      }
    });
  }

  return {
    parsed,
    filter: must.length > 0 ? { must } : undefined
  };
}

module.exports = {
  buildQdrantFilter,
  hasStructuredDateFilter,
  normalizeExplicitFilters
};
