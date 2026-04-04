import { Body, Controller, Get, Post } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

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
}
