import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard } from './auth/admin-auth.guard';
import { DashboardService } from './dashboard.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { memoryStorage } = require('multer') as {
  memoryStorage: () => unknown;
};

@Controller('api')
export class AppController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'keamanan-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('dashboard')
  async getDashboard(): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.getDashboard(),
    };
  }

  @Post('personnel')
  @UseGuards(AdminAuthGuard)
  async createPersonnel(
    @Body()
    body: {
      name: string;
      location: string;
      status?: 'Valid' | 'Perpanjangan' | 'Pelatihan';
      licenseNumber?: string;
      address?: string;
      documentPeriod?: string;
      sourceDocument?: string;
      birthPlaceDate?: string;
      maritalStatus?: string;
      religion?: string;
      educationHistory?: string[];
      workHistory?: string[];
      trainingHistory?: string[];
      refreshmentExisting?: string;
      refreshmentPlan?: string;
      recurrentExisting?: string;
      recurrentPlan?: string;
    }
  ): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.createPersonnel(body),
    };
  }

  @Delete('personnel')
  @UseGuards(AdminAuthGuard)
  async clearPersonnel(): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.clearPersonnel(),
    };
  }

  @Delete('personnel/:slug')
  @UseGuards(AdminAuthGuard)
  async deletePersonnel(@Param('slug') slug: string): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.deletePersonnel(slug),
    };
  }

  @Delete('documents')
  @UseGuards(AdminAuthGuard)
  async clearDocuments(): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.clearDocuments(),
    };
  }

  @Delete('documents/:sourceType/:id')
  @UseGuards(AdminAuthGuard)
  async deleteDocument(
    @Param('sourceType') sourceType: 'manual' | 'evidence',
    @Param('id') id: string
  ): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.deleteDocument(sourceType, id),
    };
  }

  @Post('personnel/:slug/photo')
  @UseGuards(AdminAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    })
  )
  async uploadPersonnelPhoto(
    @Param('slug') slug: string,
    @UploadedFile()
    photo?: {
      originalname?: string;
      mimetype?: string;
      buffer?: Buffer;
    }
  ): Promise<{ data: unknown }> {
    if (!photo?.buffer) {
      throw new BadRequestException('Foto personel wajib diunggah.');
    }

    return {
      data: await this.dashboardService.uploadPersonnelPhoto(slug, photo),
    };
  }

  @Post('facilities')
  @UseGuards(AdminAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    })
  )
  async createFacility(
    @Body()
    body: {
      name: string;
      zone: string;
      status?: 'Optimal' | 'Perlu Servis' | 'Terjadwal';
      coveragePercent: number | string;
    },
    @UploadedFile()
    photo?: {
      originalname?: string;
      mimetype?: string;
      buffer?: Buffer;
    }
  ): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.createFacility(body, photo),
    };
  }

  @Delete('facilities/:id')
  @UseGuards(AdminAuthGuard)
  async deleteFacility(@Param('id') id: string): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.deleteFacility(id),
    };
  }

  @Patch('supervision-activities/:activityId/status')
  @UseGuards(AdminAuthGuard)
  async updateSupervisionStatus(
    @Param('activityId') activityId: string,
    @Body()
    body: {
      status?: 'Terlaksana' | 'Perlu Tindak Lanjut';
      location?: string | null;
      completedAt?: string | null;
      completionNote?: string | null;
      inspectorNames?: string[] | null;
    }
  ): Promise<{ data: unknown }> {
    if (!body.status) {
      throw new BadRequestException('Status kegiatan pengawasan wajib diisi.');
    }

    return {
      data: await this.dashboardService.updateSupervisionStatus(activityId, {
        status: body.status,
        location: body.location,
        completedAt: body.completedAt,
        completionNote: body.completionNote,
        inspectorNames: body.inspectorNames,
      }),
    };
  }

  @Post('supervision-activities/:activityId/evidence')
  @UseGuards(AdminAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    })
  )
  async uploadSupervisionEvidence(
    @Param('activityId') activityId: string,
    @UploadedFile() file?: {
      originalname?: string;
      mimetype?: string;
      size?: number;
      buffer?: Buffer;
    }
  ): Promise<{ data: unknown }> {
    if (!file?.buffer) {
      throw new BadRequestException('File evidence wajib diunggah.');
    }

    return {
      data: await this.dashboardService.uploadSupervisionEvidence(activityId, file),
    };
  }
}
