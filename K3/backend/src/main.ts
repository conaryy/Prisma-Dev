import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as express from 'express';
import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
  });

  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  const uploadsDir = join(__dirname, '..', 'uploads');
  const server = app.getHttpAdapter().getInstance();

  server.use('/uploads', express.static(uploadsDir));

  if (existsSync(frontendDist)) {
    server.use(express.static(frontendDist));
    server.get(/^\/(?!api).*/, (_request: Request, response: Response) => {
      response.sendFile(join(frontendDist, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3106);
  await app.listen(port);
}

void bootstrap();
