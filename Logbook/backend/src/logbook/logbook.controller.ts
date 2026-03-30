import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserDecorator } from '../auth/current-user.decorator';
import { SsoAuthGuard } from '../auth/sso-auth.guard';
import type { CurrentUser } from '../common/current-user';
import { QueryLogbookDto } from './dto/query-logbook.dto';
import { LogbookService } from './logbook.service';

@Controller('logbook')
@UseGuards(SsoAuthGuard)
export class LogbookController {
  constructor(private readonly logbookService: LogbookService) {}

  @Get('me')
  getSession(@CurrentUserDecorator() user: CurrentUser | undefined) {
    return {
      user,
      permissions: {
        canManage: user?.roles.some((role) => role.includes('admin')) ?? false,
      },
    };
  }

  @Get('entries')
  async listEntries(@Query() query: QueryLogbookDto) {
    const category = query.category;
    const limit = query.limit ?? 200;

    const entries = await this.logbookService.findEntries({ category, limit });

    return {
      data: entries,
      meta: {
        category,
        total: entries.length,
        limit,
      },
    };
  }
}
