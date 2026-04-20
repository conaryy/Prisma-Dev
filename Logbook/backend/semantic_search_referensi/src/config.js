function getConfig() {
  const embeddingProvider = process.env.EMBEDDING_PROVIDER || "ollama";
  const chatProvider = process.env.CHAT_PROVIDER || "ollama";
  const requiredEnv = ["QDRANT_URL", "QDRANT_COLLECTION", "DATABASE_URL"];

  if (embeddingProvider === "gemini") {
    requiredEnv.push("GEMINI_API_KEY");
  }

  if (embeddingProvider === "ollama") {
    requiredEnv.push("OLLAMA_URL", "OLLAMA_EMBEDDING_MODEL");
  }

  if (chatProvider === "gemini") {
    requiredEnv.push("GEMINI_API_KEY");
  }

  if (chatProvider === "ollama") {
    requiredEnv.push("OLLAMA_URL", "OLLAMA_CHAT_MODEL");
  }

  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  return {
    embeddingProvider,
    chatProvider,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
    ollamaUrl: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
    ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "qwen3-embedding",
    chatModel:
      chatProvider === "gemini"
        ? process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash"
        : process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b",
    chatStructuredLimit: Number(process.env.CHAT_STRUCTURED_LIMIT || 100),
    chatChunkSize: Number(process.env.CHAT_CHUNK_SIZE || 20),
    chatChunkThreshold: Number(process.env.CHAT_CHUNK_THRESHOLD || 25),
    lexicalExactBoost: Number(process.env.SEARCH_LEXICAL_EXACT_BOOST || 0.2),
    lexicalPartialBoost: Number(process.env.SEARCH_LEXICAL_PARTIAL_BOOST || 0.08),
    lexicalOverlapBoost: Number(process.env.SEARCH_LEXICAL_OVERLAP_BOOST || 0.18),
    lexicalPartialMinLength: Number(process.env.SEARCH_LEXICAL_PARTIAL_MIN_LENGTH || 12),
    lexicalModeAuto: (process.env.SEARCH_LEXICAL_MODE_AUTO || "true").toLowerCase() !== "false",
    lexicalStringHeavyMultiplier: Number(process.env.SEARCH_LEXICAL_STRING_HEAVY_MULTIPLIER || 1.8),
    lexicalNaturalMultiplier: Number(process.env.SEARCH_LEXICAL_NATURAL_MULTIPLIER || 1.0),
    databaseUrl: process.env.DATABASE_URL,
    qdrantUrl: process.env.QDRANT_URL,
    qdrantApiKey: process.env.QDRANT_API_KEY || undefined,
    qdrantCollection: process.env.QDRANT_COLLECTION
  };
}

module.exports = { getConfig };
