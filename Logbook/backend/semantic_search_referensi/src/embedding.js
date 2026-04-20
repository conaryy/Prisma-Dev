const { GoogleGenAI } = require("@google/genai");
const { getConfig } = require("./config");

let client;

function getGeminiClient() {
  if (!client) {
    const config = getConfig();
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  return client;
}

async function createGeminiEmbedding(text, config) {
  const response = await getGeminiClient().models.embedContent({
    model: config.geminiEmbeddingModel,
    contents: text,
    config: {
      taskType: "SEMANTIC_SIMILARITY"
    }
  });

  return response.embeddings[0].values;
}

async function createOllamaEmbedding(text, config) {
  const response = await fetch(`${config.ollamaUrl}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.ollamaEmbeddingModel,
      input: text
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama embedding request failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.embeddings) || !Array.isArray(data.embeddings[0])) {
    throw new Error("Ollama did not return a valid embedding vector.");
  }

  return data.embeddings[0];
}

async function createEmbedding(text) {
  const config = getConfig();

  if (config.embeddingProvider === "gemini") {
    return createGeminiEmbedding(text, config);
  }

  if (config.embeddingProvider === "ollama") {
    return createOllamaEmbedding(text, config);
  }

  throw new Error(`Unsupported embedding provider: ${config.embeddingProvider}`);
}

module.exports = { createEmbedding };
