import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { getSemanticSearchConfig } from './semantic-search.config';
import { buildEmbeddingText, buildPayload, buildPointId } from './semantic-search.documents';
import { SemanticSearchEmbeddingService } from './semantic-search.embedding';
import { SemanticSearchPostgresService } from './semantic-search.postgres';
import { SemanticSearchQdrantService } from './semantic-search.qdrant';

type ReindexParams = {
  fullReindex?: boolean;
  batchSize?: number;
  resume?: boolean;
  stateFile?: string;
  onProgress?: (event: ReindexProgressEvent) => void;
};

export type ReindexProgressEvent = {
  type: 'start' | 'skip' | 'batch' | 'done';
  processed: number;
  indexed: number;
  skipped: number;
  total: number;
  message: string;
};

type ReindexState = {
  fingerprint: string;
  completedIds: string[];
};

const STATE_VERSION = '1';

function resolveStateFile(value?: string) {
  return value?.trim() || path.join(process.cwd(), '.semantic-seed-state.json');
}

@Injectable()
export class SemanticSearchIndexingService {
  constructor(
    private readonly semanticSearchEmbeddingService: SemanticSearchEmbeddingService,
    private readonly semanticSearchPostgresService: SemanticSearchPostgresService,
    private readonly semanticSearchQdrantService: SemanticSearchQdrantService
  ) {}

  private getStateFingerprint(collectionName: string, provider: string, model: string) {
    return `${STATE_VERSION}|${collectionName}|${provider}:${model}`;
  }

  private getEmbeddingModelLabel(config: ReturnType<typeof getSemanticSearchConfig>) {
    return config.embeddingProvider === 'gemini'
      ? config.geminiEmbeddingModel
      : config.ollamaEmbeddingModel;
  }

  private loadState(stateFile: string, fingerprint: string): ReindexState {
    if (!existsSync(stateFile)) {
      return { fingerprint, completedIds: [] };
    }

    try {
      const parsed = JSON.parse(readFileSync(stateFile, 'utf8')) as Partial<ReindexState>;
      if (parsed.fingerprint !== fingerprint || !Array.isArray(parsed.completedIds)) {
        return { fingerprint, completedIds: [] };
      }

      return {
        fingerprint,
        completedIds: parsed.completedIds.filter((value): value is string => typeof value === 'string'),
      };
    } catch {
      return { fingerprint, completedIds: [] };
    }
  }

  private saveState(stateFile: string, state: ReindexState) {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }

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

    const stateFile = resolveStateFile(params.stateFile);
    const batchSize = Math.max(1, Math.min(params.batchSize ?? 25, 100));
    const fingerprint = this.getStateFingerprint(
      config.collectionName ?? '',
      config.embeddingProvider,
      this.getEmbeddingModelLabel(config)
    );

    if (params.fullReindex) {
      await this.semanticSearchQdrantService.resetCollection();
      if (existsSync(stateFile)) {
        unlinkSync(stateFile);
      }
    }

    const state = params.resume === false
      ? { fingerprint, completedIds: [] }
      : this.loadState(stateFile, fingerprint);
    const completedIdSet = new Set(state.completedIds);
    const entries = await this.semanticSearchPostgresService.fetchAllActiveEntries();
    const entriesWithPointIds = entries.map((entry) => ({
      entry,
      pointId: buildPointId(entry),
    }));
    const entriesToIndex = entriesWithPointIds.filter((item) => !completedIdSet.has(item.pointId));

    params.onProgress?.({
      type: 'start',
      processed: 0,
      indexed: 0,
      skipped: entries.length - entriesToIndex.length,
      total: entries.length,
      message: `Memulai indexing ${entriesToIndex.length} dari ${entries.length} entry aktif.`,
    });

    if (entries.length === 0) {
      return {
        indexed: 0,
        total: 0,
        skipped: 0,
        fullReindex: Boolean(params.fullReindex),
        collection: config.collectionName,
        message: 'Tidak ada entry aktif untuk diindex.',
      };
    }

    const points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];
    let processed = 0;
    let indexed = 0;
    let vectorSize: number | null = null;

    for (const { entry, pointId } of entriesToIndex) {
      const vector = await this.semanticSearchEmbeddingService.createEmbedding(buildEmbeddingText(entry));
      vectorSize ??= vector.length;
      await this.semanticSearchQdrantService.ensureCollection(vectorSize);

      points.push({
        id: pointId,
        vector,
        payload: buildPayload(entry),
      });

      if (points.length >= batchSize) {
        const flushedPoints = points.splice(0, points.length);
        await this.semanticSearchQdrantService.upsertPoints(flushedPoints);
        indexed += flushedPoints.length;
        processed += flushedPoints.length;
        state.completedIds.push(...flushedPoints.map((point) => point.id));
        this.saveState(stateFile, state);
        params.onProgress?.({
          type: 'batch',
          processed,
          indexed,
          skipped: entries.length - entriesToIndex.length,
          total: entries.length,
          message: `Indexed ${indexed}/${entriesToIndex.length} pending entries.`,
        });
      }
    }

    if (points.length > 0) {
      const flushedPoints = points.splice(0, points.length);
      await this.semanticSearchQdrantService.upsertPoints(flushedPoints);
      indexed += flushedPoints.length;
      processed += flushedPoints.length;
      state.completedIds.push(...flushedPoints.map((point) => point.id));
      this.saveState(stateFile, state);
    }

    params.onProgress?.({
      type: 'done',
      processed,
      indexed,
      skipped: entries.length - entriesToIndex.length,
      total: entries.length,
      message: `Selesai mengindex ${indexed} entry aktif ke Qdrant.`,
    });

    return {
      indexed,
      total: entries.length,
      skipped: entries.length - entriesToIndex.length,
      fullReindex: Boolean(params.fullReindex),
      resumed: params.resume !== false,
      batchSize,
      vectorSize,
      collection: config.collectionName,
      stateFile,
      message: `Berhasil mengindex ${indexed} entry aktif ke Qdrant.`,
    };
  }
}
