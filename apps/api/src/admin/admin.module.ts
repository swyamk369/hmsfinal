import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminLabCatalogController } from './admin-lab.controller';
import { AdminInsuranceController } from './admin-insurance.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, AdminLabCatalogController, AdminInsuranceController],
  providers: [AdminService],
})
export class AdminModule {}
