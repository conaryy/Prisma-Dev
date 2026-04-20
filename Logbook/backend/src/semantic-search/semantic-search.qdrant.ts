import { Injectable } from '@nestjs/common';
import { getSemanticSearchConfig } from './semantic-search.config';

@Injectable()
export class SemanticSearchQdrantService {
  async search(vector: number[], limit: number, filter?: Record<string, unknown>) {
    const config = getSemanticSearchConfig();

    if (!config.qdrantUrl || !config.collectionName) {
      throw new Error('Semantic search belum dikonfigurasi lengkap untuk Qdrant.');
    }

    const response = await fetch(
      `${config.qdrantUrl.replace(/\/$/, '')}/collections/${config.collectionName}/points/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {}),
        },
        body: JSON.stringify({
          vector,
          limit,
          with_payload: true,
          filter,
        }),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Qdrant search failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as { result?: Array<Record<string, unknown>> };
    return Array.isArray(data.result) ? data.result : [];
  }
}
