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

  @Patch('supervision-activities/:activityId/status')
  async updateSupervisionStatus(
    @Param('activityId') activityId: string,
    @Body()
    body: {
      status?: 'Belum Terlaksana' | 'Terlaksana' | 'Perlu Tindak Lanjut';
    }
  ): Promise<{ data: unknown }> {
    if (!body.status) {
      throw new BadRequestException('Status kegiatan pengawasan wajib diisi.');
    }

    return {
      data: await this.dashboardService.updateSupervisionStatus(activityId, body.status),
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
