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

export const WARD_TYPES = ['GENERAL', 'PRIVATE', 'ICU', 'HDU', 'MATERNITY', 'PEDIATRIC'] as const;
export const BED_STATUSES = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'] as const;
export const MED_ADMIN_STATUSES = ['ADMINISTERED', 'REFUSED', 'MISSED', 'HELD'] as const;

// ── Wards ───────────────────────────────────────────────────────
export class CreateWardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(WARD_TYPES)
  type?: (typeof WARD_TYPES)[number];
}

export class UpdateWardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(WARD_TYPES)
  type?: (typeof WARD_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ── Beds ────────────────────────────────────────────────────────
export class CreateBedDto {
  @IsUUID()
  wardId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  bedNumber!: string;

  @IsOptional()
  @IsIn(BED_STATUSES)
  status?: (typeof BED_STATUSES)[number];
}

export class UpdateBedDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  bedNumber?: string;

  @IsOptional()
  @IsIn(BED_STATUSES)
  status?: (typeof BED_STATUSES)[number];
}

// ── Admissions ──────────────────────────────────────────────────
export class CreateAdmissionDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  bedId!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsDateString()
  expectedDischargeAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TransferDto {
  @IsUUID()
  toBedId!: string;

  @IsReason()
  reason!: string;
}

export class RoundDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  notes!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;
}

export class ChargeDto {
  @IsOptional()
  @IsUUID()
  catalogId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  // minor units
  @IsInt()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class DischargeDto {
  @IsReason()
  reason!: string;

  @IsString()
  @IsNotEmpty({ message: 'summary is required' })
  @MaxLength(5000)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}

// ── Nursing ─────────────────────────────────────────────────────
export class NursingVitalsDto {
  @IsOptional() @IsInt() @Min(0) @Max(400) systolicBp?: number;
  @IsOptional() @IsInt() @Min(0) @Max(300) diastolicBp?: number;
  @IsOptional() @IsInt() @Min(0) @Max(400) pulse?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(120) temperature?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) spo2?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(700) weightKg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) heightCm?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) respiratoryRate?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class NursingNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  note!: string;
}

export class MedAdminDto {
  @IsOptional()
  @IsUUID()
  prescriptionItemId?: string;

  @IsOptional()
  @IsIn(MED_ADMIN_STATUSES)
  status?: (typeof MED_ADMIN_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateMedAdminDto {
  @IsOptional()
  @IsIn(MED_ADMIN_STATUSES)
  status?: (typeof MED_ADMIN_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
