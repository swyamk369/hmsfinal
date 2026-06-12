import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsReason } from '../common/validation';
import { PAYMENT_METHODS } from '../billing/dto';

export const CHARGE_SOURCES = ['OPD', 'LAB', 'PHARMACY', 'IPD', 'MANUAL', 'INSURANCE'] as const;
export const APPROVAL_TYPES = [
  'REFUND',
  'DISCOUNT',
  'WRITE_OFF',
  'BILL_CANCEL',
  'DAY_CLOSE_REOPEN',
  'DISCHARGE_OVERRIDE',
] as const;

export class CreateChargeDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @IsOptional()
  @IsUUID()
  catalogId?: string;

  @IsIn(CHARGE_SOURCES)
  sourceModule!: (typeof CHARGE_SOURCES)[number];

  @IsString()
  @MaxLength(80)
  sourceType!: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitPrice!: number;
}

export class CancelChargeDto {
  @IsReason()
  reason!: string;
}

export class BillFromChargesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  chargeIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class FinancePaymentDto {
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

export class FinanceRefundDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsReason()
  reason!: string;
}

export class FinanceCancelBillDto {
  @IsReason()
  reason!: string;
}

export class DayCloseDto {
  @IsOptional()
  @IsDateString()
  businessDate?: string;

  @IsOptional()
  @IsUUID()
  cashierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class RequestApprovalDto {
  @IsIn(APPROVAL_TYPES)
  type!: (typeof APPROVAL_TYPES)[number];

  @IsString()
  @MaxLength(80)
  entity!: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsReason()
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ApprovalDecisionDto {
  @IsReason()
  reason!: string;
}

export class SplitPaymentLineDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsIn(PAYMENT_METHODS)
  method!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionId?: string;
}

export class SplitPaymentDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SplitPaymentLineDto)
  payments!: SplitPaymentLineDto[];
}
