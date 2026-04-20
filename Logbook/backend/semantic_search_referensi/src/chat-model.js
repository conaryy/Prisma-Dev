const { GoogleGenAI } = require("@google/genai");
const { getConfig } = require("./config");

let geminiClient;

function getGeminiClient() {
  if (!geminiClient) {
    const config = getConfig();
    geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }

  return geminiClient;
}

async function generateWithOllama(prompt, config) {
  const response = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.chatModel,
      stream: true,
      messages: [
        {
          role: "system",
          content: "Anda adalah asisten analisis logbook. Jawab ringkas, faktual, dan hanya berdasarkan konteks yang diberikan. Jika konteks tidak cukup, katakan dengan jelas."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Ollama chat request failed: ${response.status} ${errorBody}`);
  }

  const raw = await response.text();
  const chunks = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return chunks.map((chunk) => chunk.message?.content || "").join("");
}

async function generateWithGemini(prompt, config) {
  const response = await getGeminiClient().models.generateContent({
    model: config.chatModel,
    contents: prompt
  });

  return response.text || "";
}

async function generateChatCompletion(prompt) {
  const config = getConfig();

  if (config.chatProvider === "ollama") {
    return generateWithOllama(prompt, config);
  }

  if (config.chatProvider === "gemini") {
    return generateWithGemini(prompt, config);
  }

  throw new Error(`Unsupported chat provider: ${config.chatProvider}`);
}

module.exports = { generateChatCompletion };
