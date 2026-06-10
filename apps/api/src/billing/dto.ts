import { IsReason } from '../common/validation';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
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

export const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'INSURANCE', 'OTHER'] as const;
export const BILL_SOURCE_TYPES = ['CONSULTATION', 'LAB', 'PHARMACY', 'IPD', 'PROCEDURE', 'MANUAL'] as const;

export class BillItemDto {
  @IsOptional()
  @IsUUID()
  catalogId?: string;

  @IsOptional()
  @IsIn(BILL_SOURCE_TYPES)
  sourceType?: (typeof BILL_SOURCE_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  // minor units
  @IsInt()
  @Min(0)
  unitPrice!: number;
}

export class CreateBillDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BillItemDto)
  items!: BillItemDto[];

  // minor units
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class PaymentDto {
  // minor units
  @IsInt()
  @Min(1)
  amount!: number;

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RefundDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsReason()
  reason!: string;
}

export class CancelBillDto {
  @IsReason()
  reason!: string;
}
