function parseBoolean(value: string | undefined, fallback = false) {
  if (!value) {
    return fallback;
  }

  return value === '1' || value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSemanticSearchConfig() {
  const embeddingProvider = process.env.SEMANTIC_SEARCH_EMBEDDING_PROVIDER?.trim() || 'ollama';

  return {
    enabled: parseBoolean(process.env.SEMANTIC_SEARCH_ENABLED),
    embeddingProvider,
    geminiApiKey: process.env.SEMANTIC_SEARCH_GEMINI_API_KEY?.trim() || null,
    geminiEmbeddingModel:
      process.env.SEMANTIC_SEARCH_GEMINI_EMBEDDING_MODEL?.trim() || 'gemini-embedding-001',
    ollamaUrl: process.env.SEMANTIC_SEARCH_OLLAMA_URL?.trim() || 'http://127.0.0.1:11434',
    ollamaEmbeddingModel:
      process.env.SEMANTIC_SEARCH_OLLAMA_EMBEDDING_MODEL?.trim() || 'qwen3-embedding',
    qdrantUrl: process.env.SEMANTIC_SEARCH_QDRANT_URL?.trim() || null,
    qdrantApiKey: process.env.SEMANTIC_SEARCH_QDRANT_API_KEY?.trim() || null,
    collectionName: process.env.SEMANTIC_SEARCH_QDRANT_COLLECTION?.trim() || null,
    lexicalExactBoost: parseNumber(process.env.SEMANTIC_SEARCH_LEXICAL_EXACT_BOOST, 0.2),
    lexicalPartialBoost: parseNumber(process.env.SEMANTIC_SEARCH_LEXICAL_PARTIAL_BOOST, 0.08),
    lexicalOverlapBoost: parseNumber(process.env.SEMANTIC_SEARCH_LEXICAL_OVERLAP_BOOST, 0.18),
    lexicalPartialMinLength: parseNumber(process.env.SEMANTIC_SEARCH_LEXICAL_PARTIAL_MIN_LENGTH, 12),
    lexicalModeAuto: parseBoolean(process.env.SEMANTIC_SEARCH_LEXICAL_MODE_AUTO, true),
    lexicalStringHeavyMultiplier: parseNumber(
      process.env.SEMANTIC_SEARCH_LEXICAL_STRING_HEAVY_MULTIPLIER,
      1.8
    ),
    lexicalNaturalMultiplier: parseNumber(
      process.env.SEMANTIC_SEARCH_LEXICAL_NATURAL_MULTIPLIER,
      1.0
    ),
  };
}
