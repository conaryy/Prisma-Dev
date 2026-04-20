import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getSemanticSearchConfig } from './semantic-search.config';
import { buildEmbeddingText, buildResult } from './semantic-search.documents';
import { buildQdrantFilter, type SemanticSearchFilters } from './semantic-search.filters';
import { SemanticSearchEmbeddingService } from './semantic-search.embedding';
import { SemanticSearchPostgresService } from './semantic-search.postgres';
import { SemanticSearchQdrantService } from './semantic-search.qdrant';

@Injectable()
export class SemanticSearchService {
  constructor(
    private readonly semanticSearchEmbeddingService: SemanticSearchEmbeddingService,
    private readonly semanticSearchPostgresService: SemanticSearchPostgresService,
    private readonly semanticSearchQdrantService: SemanticSearchQdrantService
  ) {}

  getStatus() {
    const config = getSemanticSearchConfig();

    return {
      runtime: 'backend-module',
      enabled: config.enabled,
      configured: Boolean(
        config.qdrantUrl &&
          config.collectionName &&
          config.embeddingProvider &&
          (config.embeddingProvider !== 'gemini' || config.geminiApiKey)
      ),
      qdrant: {
        urlConfigured: Boolean(config.qdrantUrl),
        collectionConfigured: Boolean(config.collectionName),
        collectionName: config.collectionName,
      },
      embedding: {
        provider: config.embeddingProvider,
      },
      scope: {
        indexing: 'planned',
        search: 'read-only',
        chat: 'not-in-scope',
      },
    };
  }

  private normalizeText(text: string) {
    return (text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(text: string) {
    return this.normalizeText(text)
      .split(' ')
      .filter((token) => token.length >= 2);
  }

  private detectQueryMode(query: string) {
    const raw = query || '';
    const uppercaseCount = (raw.match(/[A-Z]/g) || []).length;
    const digitCount = (raw.match(/\d/g) || []).length;
    const symbolCount = (raw.match(/[/:.\-]/g) || []).length;
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    const uppercaseTokenCount = tokens.filter(
      (token) => /^[A-Z0-9/:.\-]+$/.test(token) && /[A-Z]/.test(token)
    ).length;

    const signalScore =
      (digitCount >= 2 ? 1 : 0) +
      (symbolCount >= 2 ? 1 : 0) +
      (uppercaseCount >= 4 ? 1 : 0) +
      (uppercaseTokenCount >= 2 ? 1 : 0);

    return signalScore >= 2 ? 'string-heavy' : 'natural';
  }

  private computeLexicalBoost(
    query: string,
    item: { title?: string; content?: string; subtitle?: string },
    config: ReturnType<typeof getSemanticSearchConfig>,
    queryMode: 'natural' | 'string-heavy'
  ) {
    const normalizedQuery = this.normalizeText(query);

    if (!normalizedQuery) {
      return 0;
    }

    const haystack = this.normalizeText(
      `${item.title || ''} ${item.content || ''} ${item.subtitle || ''}`
    );
    const queryTokens = this.tokenize(query);
    const modeMultiplier =
      queryMode === 'string-heavy'
        ? config.lexicalStringHeavyMultiplier
        : config.lexicalNaturalMultiplier;

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

  async search(
    query: string,
    limit = 5,
    filters: SemanticSearchFilters = {}
  ) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      throw new BadRequestException('Query semantic search wajib diisi.');
    }

    const config = getSemanticSearchConfig();

    if (!this.getStatus().configured) {
      throw new ServiceUnavailableException('Semantic search belum dikonfigurasi lengkap.');
    }

    const vector = await this.semanticSearchEmbeddingService.createEmbedding(trimmedQuery);
    const { filter, parsed } = buildQdrantFilter(filters);
    const qdrantResults = await this.semanticSearchQdrantService.search(vector, limit, filter);
    const refs = qdrantResults.map((point) => ({
      score: Number(point.score || 0),
      sourceType: String((point.payload as Record<string, unknown>)?.source_type || '') as
        | 'tower'
        | 'app'
        | 'teknik',
      sourceId: String((point.payload as Record<string, unknown>)?.source_id || ''),
    }));

    const entries = await this.semanticSearchPostgresService.fetchEntriesByRefs(refs);
    const entryMap = new Map(entries.map((entry) => [`${entry.source_type}:${entry.source_id}`, entry]));
    const queryMode = config.lexicalModeAuto ? this.detectQueryMode(trimmedQuery) : 'natural';

    return refs
      .map((ref) => {
        const entry = entryMap.get(`${ref.sourceType}:${ref.sourceId}`);

        if (!entry) {
          return null;
        }

        const result = buildResult(entry);
        const lexicalBoost = this.computeLexicalBoost(trimmedQuery, result, config, queryMode);

        return {
          ...result,
          appliedFilters: parsed,
          semanticScore: ref.score,
          lexicalBoost,
          queryMode,
          score: ref.score + lexicalBoost,
        };
      })
      .filter(Boolean)
      .sort((left, right) => (right?.score || 0) - (left?.score || 0));
  }

  async searchStructured(filters: SemanticSearchFilters, limit = 10) {
    const entries = await this.semanticSearchPostgresService.fetchStructuredEntries(filters, limit);

    return entries.map((entry) => ({
      ...buildResult(entry),
      semanticScore: 1,
      lexicalBoost: 0,
      queryMode: 'structured',
      score: 1,
      appliedFilters: filters,
      embeddingText: buildEmbeddingText(entry),
    }));
  }
}
