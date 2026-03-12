import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ChecklistAuditService } from './checklist-audit.service';

@Module({
  controllers: [AppController],
  providers: [ChecklistAuditService],
})
export class AppModule {}
