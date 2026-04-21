import { BadRequestException, Injectable } from '@nestjs/common';
import { getSemanticSearchConfig } from './semantic-search.config';
import { buildEmbeddingText, buildPayload, buildPointId } from './semantic-search.documents';
import { SemanticSearchEmbeddingService } from './semantic-search.embedding';
import { SemanticSearchPostgresService } from './semantic-search.postgres';
import { SemanticSearchQdrantService } from './semantic-search.qdrant';

type ReindexParams = {
  fullReindex?: boolean;
  batchSize?: number;
};

@Injectable()
export class SemanticSearchIndexingService {
  constructor(
    private readonly semanticSearchEmbeddingService: SemanticSearchEmbeddingService,
    private readonly semanticSearchPostgresService: SemanticSearchPostgresService,
    private readonly semanticSearchQdrantService: SemanticSearchQdrantService
  ) {}

  async reindex(params: ReindexParams = {}) {
    const config = getSemanticSearchConfig();
    const configured = Boolean(
      config.qdrantUrl &&
        config.collectionName &&
        config.embeddingProvider &&
        (config.embeddingProvider !== 'gemini' || config.geminiApiKey)
    );

    if (!configured) {
      throw new BadRequestException('Semantic search belum dikonfigurasi lengkap.');
    }

    const entries = await this.semanticSearchPostgresService.fetchAllActiveEntries();
    if (entries.length === 0) {
      return {
        indexed: 0,
        total: 0,
        fullReindex: Boolean(params.fullReindex),
        collection: config.collectionName,
        message: 'Tidak ada entry aktif untuk diindex.',
      };
    }

    if (params.fullReindex) {
      await this.semanticSearchQdrantService.resetCollection();
    }

    const batchSize = Math.max(1, Math.min(params.batchSize ?? 25, 100));
    const points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];
    let indexed = 0;
    let vectorSize: number | null = null;

    for (const entry of entries) {
      const vector = await this.semanticSearchEmbeddingService.createEmbedding(buildEmbeddingText(entry));
      vectorSize ??= vector.length;
      await this.semanticSearchQdrantService.ensureCollection(vectorSize);

      points.push({
        id: buildPointId(entry),
        vector,
        payload: buildPayload(entry),
      });

      if (points.length >= batchSize) {
        await this.semanticSearchQdrantService.upsertPoints(points.splice(0, points.length));
      }

      indexed += 1;
    }

    await this.semanticSearchQdrantService.upsertPoints(points);

    return {
      indexed,
      total: entries.length,
      fullReindex: Boolean(params.fullReindex),
      batchSize,
      vectorSize,
      collection: config.collectionName,
      message: `Berhasil mengindex ${indexed} entry aktif ke Qdrant.`,
    };
  }
}
