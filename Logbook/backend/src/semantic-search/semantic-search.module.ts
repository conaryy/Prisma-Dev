import { Module } from '@nestjs/common';
import { SemanticSearchController } from './semantic-search.controller';
import { SemanticSearchEmbeddingService } from './semantic-search.embedding';
import { SemanticSearchPostgresService } from './semantic-search.postgres';
import { SemanticSearchQdrantService } from './semantic-search.qdrant';
import { SemanticSearchService } from './semantic-search.service';

@Module({
  controllers: [SemanticSearchController],
  providers: [
    SemanticSearchService,
    SemanticSearchEmbeddingService,
    SemanticSearchPostgresService,
    SemanticSearchQdrantService,
  ],
  exports: [SemanticSearchService],
})
export class SemanticSearchModule {}
