import { Controller, Get } from '@nestjs/common';
import { platformDb } from '@hms/db';
import { Public } from '../common/decorators';
import { firebaseConfigured } from '../common/firebase-credentials';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  async health() {
    let db = 'down';
    try {
      await platformDb.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      firebaseConfigured: firebaseConfigured(),
      ts: new Date().toISOString(),
    };
  }
}
