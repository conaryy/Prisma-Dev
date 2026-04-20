const { createEmbedding } = require("./embedding");
const { getConfig } = require("./config");
const { getQdrantClient } = require("./qdrant");
const { buildResult } = require("./logbook-documents");
const { fetchEntriesByRefs, fetchEntriesByStructuredFilters } = require("./postgres");
const { buildQdrantFilter, normalizeExplicitFilters } = require("./query-filters");

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function detectQueryMode(query) {
  const raw = query || "";
  const uppercaseCount = (raw.match(/[A-Z]/g) || []).length;
  const digitCount = (raw.match(/\d/g) || []).length;
  const symbolCount = (raw.match(/[/:.\-]/g) || []).length;
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const uppercaseTokenCount = tokens.filter((token) => /^[A-Z0-9/:.\-]+$/.test(token) && /[A-Z]/.test(token)).length;

  const signalScore =
    (digitCount >= 2 ? 1 : 0) +
    (symbolCount >= 2 ? 1 : 0) +
    (uppercaseCount >= 4 ? 1 : 0) +
    (uppercaseTokenCount >= 2 ? 1 : 0);

  return signalScore >= 2 ? "string-heavy" : "natural";
}

function computeLexicalBoost(query, item, config, queryMode) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return 0;
  }

  const haystack = normalizeText(`${item.title || ""} ${item.content || ""} ${item.subtitle || ""}`);
  const queryTokens = tokenize(query);
  const modeMultiplier =
    queryMode === "string-heavy" ? config.lexicalStringHeavyMultiplier : config.lexicalNaturalMultiplier;

  let boost = 0;

  if (haystack.includes(normalizedQuery)) {
    boost += config.lexicalExactBoost * modeMultiplier;
  }

  if (
    normalizedQuery.length >= config.lexicalPartialMinLength &&
    haystack.includes(normalizedQuery.slice(0, Math.max(8, normalizedQuery.length - 4)))
  ) {
    boost += config.lexicalPartialBoost * modeMultiplier;
  }

  if (queryTokens.length > 0) {
    const overlapCount = queryTokens.filter((token) => haystack.includes(token)).length;
    boost += (overlapCount / queryTokens.length) * config.lexicalOverlapBoost * modeMultiplier;
  }

  return boost;
}

function rerankResults(query, results, config) {
  const queryMode = config.lexicalModeAuto ? detectQueryMode(query) : "natural";

  return results
    .map((item) => {
      const lexicalBoost = computeLexicalBoost(query, item, config, queryMode);
      return {
        ...item,
        queryMode,
        semanticScore: item.score,
        lexicalBoost,
        score: item.score + lexicalBoost
      };
    })
    .sort((left, right) => right.score - left.score);
}

function formatEntries(entries, score, parsed) {
  return entries.map((entry) => ({
    score,
    appliedFilters: parsed,
    ...buildResult(entry)
  }));
}

async function retrieveDocuments(query, limit = 5, explicitFilters = {}) {
  const config = getConfig();
  const qdrant = getQdrantClient();
  const vector = await createEmbedding(query);
  const { filter, parsed } = buildQdrantFilter(explicitFilters);

  const response = await qdrant.search(config.qdrantCollection, {
    vector,
    limit,
    with_payload: true,
    filter
  });

  const refs = response.map((point) => ({
    score: point.score,
    sourceType: point.payload.source_type,
    sourceId: point.payload.source_id
  }));
  const entries = await fetchEntriesByRefs(refs);
  const entryMap = new Map(entries.map((entry) => [`${entry.source_type}:${entry.source_id}`, entry]));

  const results = refs
    .map((ref) => {
      const entry = entryMap.get(`${ref.sourceType}:${ref.sourceId}`);

      if (!entry) {
        return null;
      }

      return {
        score: ref.score,
        appliedFilters: parsed,
        ...buildResult(entry)
      };
    })
    .filter(Boolean);

  return rerankResults(query, results, config);
}

async function retrieveStructuredDocuments(query, limit = 100, explicitFilters = {}) {
  const parsed = normalizeExplicitFilters(explicitFilters);
  const entries = await fetchEntriesByStructuredFilters(parsed, limit);
  return formatEntries(entries, 1, parsed);
}

module.exports = { retrieveDocuments, retrieveStructuredDocuments };
