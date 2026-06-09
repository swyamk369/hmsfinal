import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { CommonModule } from './common/common.module';
import { AuthMiddleware } from './common/auth.middleware';
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
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    PlatformModule,
    AdminModule,
    StaffModule,
    PatientModule,
    OpdModule,
    BillingModule,
    LabModule,
    HealthModule,
  ],
  providers: [
    AuthMiddleware,
    // Global guard chain (in order): authenticated → tenant/status valid →
    // has permission → module enabled.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
