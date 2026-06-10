import { IsReason } from '../common/validation';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CLAIM_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'SETTLED',
  'CANCELLED',
] as const;

export class CreatePolicyDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  policyNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  memberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  coverageType?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  // minor units
  @IsOptional()
  @IsInt()
  @Min(0)
  coverageLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  patientSharePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePolicyDto {
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  policyNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  memberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  coverageType?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  coverageLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  patientSharePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateClaimDto {
  @IsUUID()
  billId!: string;

  @IsUUID()
  patientPolicyId!: string;

  // minor units; calculated from bill/policy when omitted.
  @IsOptional()
  @IsInt()
  @Min(1)
  claimAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  patientShare?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class ClaimNotesDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ClaimReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ApproveClaimDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  approvedAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  patientShare?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class RejectClaimDto {
  @IsReason()
  reason!: string;
}

export class CancelClaimDto {
  @IsReason()
  reason!: string;
}

export class SettleClaimDto {
  // minor units; defaults to approved outstanding amount.
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transactionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
