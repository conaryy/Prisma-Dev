import { Module } from '@nestjs/common';
import { SemanticSearchController } from './semantic-search.controller';
import { SemanticSearchEmbeddingService } from './semantic-search.embedding';
import { SemanticSearchIndexingService } from './semantic-search.indexing';
import { SemanticSearchPostgresService } from './semantic-search.postgres';
import { SemanticSearchQdrantService } from './semantic-search.qdrant';
import { SemanticSearchService } from './semantic-search.service';

@Module({
  controllers: [SemanticSearchController],
  providers: [
    SemanticSearchService,
    SemanticSearchIndexingService,
    SemanticSearchEmbeddingService,
    SemanticSearchPostgresService,
    SemanticSearchQdrantService,
  ],
  exports: [SemanticSearchService, SemanticSearchIndexingService],
})
export class SemanticSearchModule {}
