import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { firebaseConfigured } from './common/firebase-credentials';

function requireEnv(keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}.`);
  }
}

async function bootstrap(): Promise<void> {
  requireEnv(['DATABASE_URL', 'APP_DATABASE_URL']);
  if (!firebaseConfigured()) {
    throw new Error(
      'Firebase Auth is mandatory but not configured. Provide a service-account JSON ' +
        '(GOOGLE_APPLICATION_CREDENTIALS / firebase-service-account.json) or the FIREBASE_* env.',
    );
  }

  const app = await NestFactory.create(AppModule, { cors: false });
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3001').split(',').map((s) => s.trim()),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on :${port} (Firebase Auth)`);
}

bootstrap();
