import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const allowedOrigins = new Set(
    process.env.CORS_ALLOW_ORIGINS?.split(',').map((x) => x.trim()).filter(Boolean) ?? []
  );
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://localhost:5174');
  allowedOrigins.add('http://localhost:5175');
  allowedOrigins.add('http://localhost:5176');
  allowedOrigins.add('http://localhost:5177');
  allowedOrigins.add('http://127.0.0.1:5173');
  allowedOrigins.add('http://127.0.0.1:5174');
  allowedOrigins.add('http://127.0.0.1:5175');
  allowedOrigins.add('http://127.0.0.1:5176');
  allowedOrigins.add('http://127.0.0.1:5177');

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          callback(null, true);
          return;
        }
      } catch {
        // Ignore invalid origin format and reject below.
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
