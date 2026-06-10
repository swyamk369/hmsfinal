import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';

@Module({
  controllers: [InventoryController, SupplierController, PurchaseController],
  providers: [InventoryService, SupplierService, PurchaseService],
  exports: [InventoryService],
})
export class InventoryModule {}
