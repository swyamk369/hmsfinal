import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CommonModule } from './common/common.module';
import { AuthMiddleware } from './common/auth.middleware';
import { RequestLoggerMiddleware } from './common/request-logger.middleware';
import { AuthGuard } from './common/guards/auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ModuleGuard } from './common/guards/module.guard';

import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { AdminModule } from './admin/admin.module';
import { StaffModule } from './staff/staff.module';
import { PatientModule } from './patient/patient.module';
import { OpdModule } from './opd/opd.module';
import { BillingModule } from './billing/billing.module';
import { LabModule } from './lab/lab.module';
import { InventoryModule } from './inventory/inventory.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { IpdModule } from './ipd/ipd.module';
import { InsuranceModule } from './insurance/insurance.module';
import { FinanceModule } from './finance/finance.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { PatientPublicModule } from './patient-public/patient-public.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit (per IP). Sensitive endpoints tighten this with
    // @Throttle overrides. Env-tunable; defaults are generous for normal use.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 300),
      },
    ]),
    CommonModule,
    AuthModule,
    PlatformModule,
    AdminModule,
    StaffModule,
    PatientModule,
    OpdModule,
    BillingModule,
    LabModule,
    InventoryModule,
    PharmacyModule,
    IpdModule,
    InsuranceModule,
    FinanceModule,
    ReportsModule,
    NotificationsModule,
    OperationsModule,
    PatientPublicModule,
    HealthModule,
  ],
  providers: [
    AuthMiddleware,
    // Global guard chain (in order): rate-limited → authenticated →
    // tenant/status valid → has permission → module enabled.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Logger first so every request (including auth failures) gets a
    // requestId and a structured log line.
    consumer.apply(RequestLoggerMiddleware, AuthMiddleware).forRoutes('*');
  }
}
