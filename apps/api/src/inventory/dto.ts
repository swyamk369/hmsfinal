import { IsReason } from '../common/validation';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const ITEM_TYPES = ['DRUG', 'CONSUMABLE', 'EQUIPMENT', 'OTHER'] as const;
export const PO_CREATE_STATUSES = ['DRAFT', 'ORDERED'] as const;

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(ITEM_TYPES)
  type?: (typeof ITEM_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(ITEM_TYPES)
  type?: (typeof ITEM_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class StockInDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  batchNumber!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  // minor units
  @IsOptional()
  @IsInt()
  @Min(0)
  unitCost?: number;

  // minor units
  @IsInt()
  @Min(0)
  salePrice!: number;
}

export class AdjustStockDto {
  @IsUUID()
  batchId!: string;

  /** Signed delta (positive to add, negative to remove). */
  @IsInt()
  delta!: number;

  @IsReason()
  reason!: string;
}

// ── Suppliers ───────────────────────────────────────────────────
export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ── Purchase orders ─────────────────────────────────────────────
export class PurchaseLineDto {
  @IsUUID()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  // minor units
  @IsInt()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceRef?: string;

  @IsOptional()
  @IsIn(PO_CREATE_STATUSES)
  status?: (typeof PO_CREATE_STATUSES)[number];

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  items!: PurchaseLineDto[];
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceRef?: string;

  @IsOptional()
  @IsIn(PO_CREATE_STATUSES)
  status?: (typeof PO_CREATE_STATUSES)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  items?: PurchaseLineDto[];
}

export class CancelPurchaseDto {
  @IsReason()
  reason!: string;
}

export class ReceiveLineDto {
  @IsUUID()
  purchaseOrderItemId!: string;

  @IsInt()
  @Min(0)
  receivedQuantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  batchNumber!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  // minor units
  @IsInt()
  @Min(0)
  salePrice!: number;
}

export class ReceiveDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}
