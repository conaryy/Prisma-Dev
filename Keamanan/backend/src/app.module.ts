import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController],
  providers: [DashboardService],
})
export class AppModule {}
