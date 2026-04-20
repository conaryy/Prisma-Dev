import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AdminAuthGuard } from './auth/admin-auth.guard';
import { JwksTokenVerifierService } from './auth/jwks-token-verifier.service';
import { DashboardService } from './dashboard.service';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController],
  providers: [DashboardService, JwksTokenVerifierService, AdminAuthGuard],
})
export class AppModule {}
