import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const LAB_ORDER_STATUSES = ['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;
export const ABNORMAL_FLAGS = ['NORMAL', 'HIGH', 'LOW', 'CRITICAL'] as const;

// ── Lab catalog ─────────────────────────────────────────────────
export class CreateLabCatalogDto {
  @IsString() @IsNotEmpty() @MaxLength(40) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(80) specimenType?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_00) price?: number;
}

export class UpdateLabCatalogDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(80) specimenType?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_00) price?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ── Lab orders ──────────────────────────────────────────────────
export class LabTestRefDto {
  @IsUUID() testId!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) testName!: string;
}

export class CreateLabOrderDto {
  @IsUUID() patientId!: string;

  @IsOptional() @IsUUID() encounterId?: string;
  @IsOptional() @IsUUID() providerId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LabTestRefDto)
  tests!: LabTestRefDto[];
}

/** Lab order created from inside an encounter — patient is inferred from the encounter. */
export class EncounterLabOrderDto {
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LabTestRefDto)
  tests!: LabTestRefDto[];
}

export class CollectSampleDto {
  /** Optional: collect for a single order item. Omit to collect for the whole order. */
  @IsOptional() @IsUUID() labOrderItemId?: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
}

export class UpdateLabStatusDto {
  @IsIn(LAB_ORDER_STATUSES) status!: (typeof LAB_ORDER_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class LabResultEntryDto {
  @IsUUID() labOrderItemId!: string;
  @IsOptional() @IsString() @MaxLength(200) testName?: string;
  @IsOptional() @IsString() @MaxLength(200) value?: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsString() @MaxLength(120) referenceRange?: string;
  @IsOptional() @IsIn(ABNORMAL_FLAGS) abnormalFlag?: (typeof ABNORMAL_FLAGS)[number];
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class EnterResultsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LabResultEntryDto)
  results!: LabResultEntryDto[];
}
