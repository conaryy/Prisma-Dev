import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SsoAuthGuard } from '../auth/sso-auth.guard';
import { ReindexSemanticDto } from './dto/reindex-semantic.dto';
import { SearchSemanticDto } from './dto/search-semantic.dto';
import { SemanticSearchIndexingService } from './semantic-search.indexing';
import { SemanticSearchService } from './semantic-search.service';

@Controller('logbook/search/semantic')
@UseGuards(SsoAuthGuard)
export class SemanticSearchController {
  constructor(
    private readonly semanticSearchService: SemanticSearchService,
    private readonly semanticSearchIndexingService: SemanticSearchIndexingService
  ) {}

  @Get('status')
  getStatus() {
    return {
      data: this.semanticSearchService.getStatus(),
    };
  }

  @Post()
  async search(@Body() body: SearchSemanticDto) {
    const limit = body.limit ?? 5;
    const filters = {
      sourceType: body.sourceType,
      startDate: body.startDate,
      endDate: body.endDate,
    };

    return {
      data: await this.semanticSearchService.search(body.query, limit, filters),
      meta: {
        limit,
        filters,
      },
    };
  }

  @Post('reindex')
  async reindex(@Body() body: ReindexSemanticDto) {
    return {
      data: await this.semanticSearchIndexingService.reindex({
        fullReindex: body.fullReindex,
        batchSize: body.batchSize,
        resume: body.resume,
        stateFile: body.stateFile,
      }),
    };
  }
}
