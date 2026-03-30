import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { HealthModule } from './health/health.module';
import { LogbookModule } from './logbook/logbook.module';
import { SsoJwtStrategy } from './auth/sso-jwt.strategy';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    HealthModule,
    LogbookModule,
  ],
  providers: [SsoJwtStrategy],
})
export class AppModule {}
