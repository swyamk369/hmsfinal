import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';
import { assertEnv } from './common/env.validation';

const configuredCorsOrigins = (): string[] =>
  (process.env.CORS_ORIGIN ?? 'http://localhost:4001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const isLocalDevOrigin = (origin: string): boolean =>
  process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

async function bootstrap(): Promise<void> {
  // Fail fast on a misconfigured environment (missing DB/Firebase, insecure
  // production CORS or default passwords). Never boot insecurely.
  assertEnv();

  const app = await NestFactory.create(AppModule, { cors: false });
  app.use(helmet());
  const corsOrigins = configuredCorsOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-HMS-Path'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on :${port} (Firebase Auth)`);
}

bootstrap();
