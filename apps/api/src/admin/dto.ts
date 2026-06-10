import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Enum value sets (mirror the Prisma enums; kept as plain arrays so class-validator
// can use them without pulling the Prisma runtime into DTO metadata).
export const CATALOG_TYPES = ['CONSULTATION', 'PROCEDURE', 'LAB', 'BED', 'OTHER'] as const;
export const WARD_TYPES = ['GENERAL', 'PRIVATE', 'ICU', 'HDU', 'MATERNITY', 'PEDIATRIC'] as const;
export const BED_STATUSES = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'] as const;

// ── Hospital profile ────────────────────────────────────────────
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  // Allow clearing the email (empty string → null); only validate when non-empty.
  @ValidateIf((o) => o.contactEmail !== undefined && o.contactEmail !== '')
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  mrnPrefix?: string;
}

// ── Facilities ──────────────────────────────────────────────────
export class CreateFacilityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class UpdateFacilityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ── Departments ─────────────────────────────────────────────────
export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ── Service catalog ─────────────────────────────────────────────
export class CreateCatalogItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsIn(CATALOG_TYPES)
  type!: (typeof CATALOG_TYPES)[number];

  // Stored in minor units (paise/cents).
  @IsInt()
  @Min(0)
  price!: number;

  // Basis points (e.g. 500 = 5%).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  taxRate?: number;
}

export class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(CATALOG_TYPES)
  type?: (typeof CATALOG_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

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

// ── Lab test catalog ────────────────────────────────────────────
export class CreateLabTestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  specimenType?: string;

  @IsInt()
  @Min(0)
  price!: number;
}

export class UpdateLabTestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  specimenType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ── Insurance providers ─────────────────────────────────────────
export class CreateInsuranceProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact?: string;
}

export class UpdateInsuranceProviderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ── Audit search ─────────────────────────────────────────────
export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entity?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
