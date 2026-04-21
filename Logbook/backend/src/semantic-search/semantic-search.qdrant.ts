import { Injectable } from '@nestjs/common';
import { getSemanticSearchConfig } from './semantic-search.config';

@Injectable()
export class SemanticSearchQdrantService {
  private buildHeaders(config: ReturnType<typeof getSemanticSearchConfig>) {
    return {
      'Content-Type': 'application/json',
      ...(config.qdrantApiKey ? { 'api-key': config.qdrantApiKey } : {}),
    };
  }

  private getCollectionUrl(config: ReturnType<typeof getSemanticSearchConfig>, suffix = '') {
    if (!config.qdrantUrl || !config.collectionName) {
      throw new Error('Semantic search belum dikonfigurasi lengkap untuk Qdrant.');
    }

    return `${config.qdrantUrl.replace(/\/$/, '')}/collections/${config.collectionName}${suffix}`;
  }

  async ensureCollection(vectorSize: number) {
    const config = getSemanticSearchConfig();
    const collectionUrl = this.getCollectionUrl(config);
    const headers = this.buildHeaders(config);
    const response = await fetch(collectionUrl, { headers });

    if (response.ok) {
      return;
    }

    if (response.status !== 404) {
      const message = await response.text();
      throw new Error(`Qdrant collection check failed: ${response.status} ${message}`);
    }

    const createResponse = await fetch(collectionUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      }),
    });

    if (!createResponse.ok) {
      const message = await createResponse.text();
      throw new Error(`Qdrant collection create failed: ${createResponse.status} ${message}`);
    }
  }

  async resetCollection() {
    const config = getSemanticSearchConfig();
    const response = await fetch(this.getCollectionUrl(config), {
      method: 'DELETE',
      headers: this.buildHeaders(config),
    });

    if (response.ok || response.status === 404) {
      return;
    }

    const message = await response.text();
    throw new Error(`Qdrant collection reset failed: ${response.status} ${message}`);
  }

  async upsertPoints(points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>) {
    if (points.length === 0) {
      return;
    }

    const config = getSemanticSearchConfig();
    const response = await fetch(this.getCollectionUrl(config, '/points?wait=true'), {
      method: 'PUT',
      headers: this.buildHeaders(config),
      body: JSON.stringify({ points }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Qdrant upsert failed: ${response.status} ${message}`);
    }
  }

  async search(vector: number[], limit: number, filter?: Record<string, unknown>) {
    const config = getSemanticSearchConfig();

    const response = await fetch(
      this.getCollectionUrl(config, '/points/search'),
      {
        method: 'POST',
        headers: this.buildHeaders(config),
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
