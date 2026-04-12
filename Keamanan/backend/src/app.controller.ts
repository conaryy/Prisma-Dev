import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  async createPersonnel(
    @Body()
    body: {
      name: string;
      location: string;
      status?: 'Valid' | 'Perpanjangan' | 'Pelatihan';
      licenseNumber?: string;
      address?: string;
    }
  ): Promise<{ data: unknown }> {
    return {
      data: await this.dashboardService.createPersonnel(body),
    };
  }

  @Post('personnel/:slug/photo')
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

  @Patch('supervision-activities/:activityId/status')
  async updateSupervisionStatus(
    @Param('activityId') activityId: string,
    @Body()
    body: {
      status?: 'Terlaksana' | 'Perlu Tindak Lanjut';
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
        completedAt: body.completedAt,
        completionNote: body.completionNote,
        inspectorNames: body.inspectorNames,
      }),
    };
  }

  @Post('supervision-activities/:activityId/evidence')
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
