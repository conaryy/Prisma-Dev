import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SsoAuthGuard } from '../auth/sso-auth.guard';
import { SearchSemanticDto } from './dto/search-semantic.dto';
import { SemanticSearchService } from './semantic-search.service';

@Controller('logbook/search/semantic')
@UseGuards(SsoAuthGuard)
export class SemanticSearchController {
  constructor(private readonly semanticSearchService: SemanticSearchService) {}

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
}
