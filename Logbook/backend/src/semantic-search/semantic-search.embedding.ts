import { Injectable } from '@nestjs/common';
import { getSemanticSearchConfig } from './semantic-search.config';

@Injectable()
export class SemanticSearchEmbeddingService {
  private async createGeminiEmbedding(text: string, config: ReturnType<typeof getSemanticSearchConfig>) {
    if (!config.geminiApiKey) {
      throw new Error('SEMANTIC_SEARCH_GEMINI_API_KEY belum diisi.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiEmbeddingModel}:embedContent?key=${config.geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: `models/${config.geminiEmbeddingModel}`,
          content: {
            parts: [{ text }],
          },
          taskType: 'SEMANTIC_SIMILARITY',
        }),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Gemini embedding request failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as { embedding?: { values?: number[] } };

    if (!Array.isArray(data.embedding?.values)) {
      throw new Error('Gemini tidak mengembalikan embedding vector yang valid.');
    }

    return data.embedding.values;
  }

  private async createOllamaEmbedding(text: string, config: ReturnType<typeof getSemanticSearchConfig>) {
    const response = await fetch(`${config.ollamaUrl.replace(/\/$/, '')}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ollamaEmbeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Ollama embedding request failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as { embeddings?: number[][] };

    if (!Array.isArray(data.embeddings) || !Array.isArray(data.embeddings[0])) {
      throw new Error('Ollama tidak mengembalikan embedding vector yang valid.');
    }

    return data.embeddings[0];
  }

  async createEmbedding(text: string) {
    const config = getSemanticSearchConfig();

    if (config.embeddingProvider === 'gemini') {
      return this.createGeminiEmbedding(text, config);
    }

    return this.createOllamaEmbedding(text, config);
  }
}
