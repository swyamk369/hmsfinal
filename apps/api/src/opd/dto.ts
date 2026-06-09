import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
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
  ValidateNested,
} from 'class-validator';

export const ENCOUNTER_TYPES = ['OPD', 'WALK_IN', 'EMERGENCY'] as const;
export const DIAGNOSIS_TYPES = ['PROVISIONAL', 'FINAL', 'DIFFERENTIAL'] as const;
export const NOTE_TYPES = ['SOAP', 'PROGRESS', 'GENERAL'] as const;

// ── Appointments ────────────────────────────────────────────────
export class CreateAppointmentDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RescheduleDto {
  @IsDateString()
  scheduledAt!: string;

  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500)
  reason!: string;
}

export class ReasonDto {
  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500)
  reason!: string;
}

// ── Encounters ──────────────────────────────────────────────────
export class CreateEncounterDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsIn(ENCOUNTER_TYPES)
  type?: (typeof ENCOUNTER_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  chiefComplaint?: string;
}

export class CompleteEncounterDto {
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  followUpNotes?: string;
}

// ── Clinical ────────────────────────────────────────────────────
export class VitalsDto {
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

export class DiagnosisDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  icdCode?: string;

  @IsOptional()
  @IsIn(DIAGNOSIS_TYPES)
  type?: (typeof DIAGNOSIS_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class NoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsIn(NOTE_TYPES)
  noteType?: (typeof NOTE_TYPES)[number];
}

// ── Prescriptions ───────────────────────────────────────────────
export class PrescriptionItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  drugName!: string;

  @IsOptional() @IsString() @MaxLength(80) dosage?: string;
  @IsOptional() @IsString() @MaxLength(80) frequency?: string;
  @IsOptional() @IsString() @MaxLength(80) duration?: string;
  @IsOptional() @IsString() @MaxLength(40) route?: string;
  @IsOptional() @IsString() @MaxLength(500) instructions?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10000) quantity?: number;
}

export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];
}
