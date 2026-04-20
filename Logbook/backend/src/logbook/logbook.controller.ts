import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUserDecorator } from '../auth/current-user.decorator';
import { SsoAuthGuard } from '../auth/sso-auth.guard';
import type { CurrentUser } from '../common/current-user';
import { ImportLogbookTeknikDto } from './dto/import-logbook-teknik.dto';
import { QueryImportBatchDetailDto } from './dto/query-import-batch-detail.dto';
import { QueryImportBatchErrorsDto } from './dto/query-import-batch-errors.dto';
import { QueryImportBatchesDto } from './dto/query-import-batches.dto';
import { QueryLogbookDto } from './dto/query-logbook.dto';
import { LogbookService } from './logbook.service';

// Keep this lightweight to avoid depending on extra type packages at runtime.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { memoryStorage } = require('multer') as {
  memoryStorage: () => unknown;
};

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
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim() ?? '';
    const sort = query.sort ?? 'desc';
    const year = query.year;
    const month = query.month;

    const result = await this.logbookService.findEntries({
      category,
      page,
      pageSize,
      search,
      sort,
      year,
      month,
    });

    return {
      data: result.data,
      meta: {
        category,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
        search,
        sort,
        year: year ?? null,
        month: month ?? null,
        availableYears: result.availableYears,
        availableMonths: result.availableMonths,
      },
    };
  }

  @Get('import-batches')
  async listImportBatches(@Query() query: QueryImportBatchesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim() ?? '';

    const result = await this.logbookService.listImportBatches({
      category: query.category,
      status: query.status,
      page,
      pageSize,
      search,
    });

    return {
      data: result.data,
      meta: {
        total: result.total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
        category: query.category ?? null,
        status: query.status ?? null,
        search,
      },
    };
  }

  @Get('import-batches/:batchId')
  async getImportBatchDetail(
    @Param('batchId') batchId: string,
    @Query() query: QueryImportBatchDetailDto
  ) {
    const sourcePage = query.sourcePage ?? 1;
    const sourcePageSize = query.sourcePageSize ?? 10;
    const auditPage = query.auditPage ?? 1;
    const auditPageSize = query.auditPageSize ?? 5;
    const result = await this.logbookService.getImportBatchDetail(batchId, {
      sourcePage,
      sourcePageSize,
      auditPage,
      auditPageSize,
    });

    return {
      data: result,
      meta: {
        sourceRows: {
          total: result.summary.sourceRows,
          page: sourcePage,
          pageSize: sourcePageSize,
          totalPages: Math.max(1, Math.ceil(result.summary.sourceRows / sourcePageSize)),
        },
        auditTrail: {
          total: result.summary.auditCount,
          page: auditPage,
          pageSize: auditPageSize,
          totalPages: Math.max(1, Math.ceil(result.summary.auditCount / auditPageSize)),
        },
      },
    };
  }

  @Get('import-batches/:batchId/errors')
  async listImportBatchErrors(
    @Param('batchId') batchId: string,
    @Query() query: QueryImportBatchErrorsDto
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const result = await this.logbookService.listImportBatchErrors(batchId, {
      page,
      pageSize,
    });

    return {
      data: result.data,
      meta: {
        total: result.total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      },
    };
  }

  @Post('import-batches/:batchId/rollback')
  async rollbackImportBatch(
    @Param('batchId') batchId: string,
    @CurrentUserDecorator() user: CurrentUser | undefined
  ) {
    return {
      message: 'Batch archived berhasil diaktifkan kembali.',
      data: await this.logbookService.rollbackImportBatch(batchId, user?.sub),
    };
  }

  @Delete('purge')
  async purgeAllLogbookData(@CurrentUserDecorator() user: CurrentUser | undefined) {
    const result = await this.logbookService.purgeAllLogbookData(user?.sub);

    return {
      message: result.message,
      data: result,
    };
  }

  @Post('import/teknik')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    })
  )
  async importTeknik(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportLogbookTeknikDto,
    @CurrentUserDecorator() user: CurrentUser | undefined
  ) {
    if (!file) {
      throw new BadRequestException('File Excel Logbook Teknik wajib diunggah.');
    }

    const originalName = file.originalname || 'teknik-import.xlsx';
    if (!/\.xlsx$/i.test(originalName)) {
      throw new BadRequestException('File Logbook Teknik harus berformat .xlsx');
    }

    const result = await this.logbookService.importTeknikEntries({
      fileName: originalName,
      buffer: file.buffer,
      sourcePeriod: body.sourcePeriod,
      importedBy: user?.sub,
      allowReimport: body.allowReimport,
    });

    return {
      message: 'Import Logbook Teknik berhasil diproses.',
      data: result,
    };
  }

  @Post('import/app')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    })
  )
  async importApp(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportLogbookTeknikDto,
    @CurrentUserDecorator() user: CurrentUser | undefined
  ) {
    if (!file) {
      throw new BadRequestException('File Excel Logbook APP wajib diunggah.');
    }

    const originalName = file.originalname || 'app-import.xlsx';
    if (!/\.xlsx$/i.test(originalName)) {
      throw new BadRequestException('File Logbook APP harus berformat .xlsx');
    }

    const result = await this.logbookService.importAppEntries({
      fileName: originalName,
      buffer: file.buffer,
      sourcePeriod: body.sourcePeriod,
      importedBy: user?.sub,
      allowReimport: body.allowReimport,
    });

    return {
      message: 'Import Logbook APP berhasil diproses.',
      data: result,
    };
  }

  @Post('import/tower')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    })
  )
  async importTower(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportLogbookTeknikDto,
    @CurrentUserDecorator() user: CurrentUser | undefined
  ) {
    if (!file) {
      throw new BadRequestException('File Excel Logbook TWR wajib diunggah.');
    }

    const originalName = file.originalname || 'tower-import.xlsx';
    if (!/\.xlsx$/i.test(originalName)) {
      throw new BadRequestException('File Logbook TWR harus berformat .xlsx');
    }

    const result = await this.logbookService.importTowerEntries({
      fileName: originalName,
      buffer: file.buffer,
      sourcePeriod: body.sourcePeriod,
      importedBy: user?.sub,
      allowReimport: body.allowReimport,
    });

    return {
      message: 'Import Logbook TWR berhasil diproses.',
      data: result,
    };
  }
}
