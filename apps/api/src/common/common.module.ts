import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { AccessService } from './access.service';
import { AuditService } from './audit.service';
import { PlatformGuard } from './guards/platform.guard';

/** Shared services available app-wide. */
@Global()
@Module({
  providers: [FirebaseService, AccessService, AuditService, PlatformGuard],
  exports: [FirebaseService, AccessService, AuditService, PlatformGuard],
})
export class CommonModule {}
