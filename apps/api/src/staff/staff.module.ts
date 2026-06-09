import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { ProvidersController } from './providers.controller';
import { PermissionsController, RolesController } from './roles.controller';
import { StaffService } from './staff.service';

@Module({
  controllers: [StaffController, ProvidersController, RolesController, PermissionsController],
  providers: [StaffService],
})
export class StaffModule {}
