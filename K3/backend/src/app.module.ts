import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller';
import { ChecklistAuditService } from './checklist-audit.service';
import { DatabaseModule } from './database/database.module';
import { GoogleDriveService } from './google-drive.service';
import { SsoJwtStrategy } from './auth/sso-jwt.strategy';
import { GoogleDriveCallbackController } from './google-drive-callback.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AppController, GoogleDriveCallbackController],
  providers: [ChecklistAuditService, GoogleDriveService, SsoJwtStrategy],
})
export class AppModule {}
