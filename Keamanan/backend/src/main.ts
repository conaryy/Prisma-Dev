import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as express from 'express';
import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseAllowedOrigins() {
  return String(
    process.env.KEAMANAN_CORS_ALLOW_ORIGINS ||
      'http://localhost:5177,https://keamanan.ryvidia.my.id,https://auth.ryvidia.my.id'
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = parseAllowedOrigins();

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin tidak diizinkan.'), false);
    },
  });

  const server = app.getHttpAdapter().getInstance();
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  const uploadsDir = join(__dirname, '..', 'uploads');

  if (existsSync(uploadsDir)) {
    server.use('/uploads', express.static(uploadsDir));
  }

  if (existsSync(frontendDist)) {
    server.use(express.static(frontendDist));
    server.get(/^\/(?!api).*/, (_request: Request, response: Response) => {
      response.sendFile(join(frontendDist, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3107);
  await app.listen(port);
}

void bootstrap();
