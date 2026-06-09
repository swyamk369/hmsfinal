import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const SEXES = ['MALE', 'FEMALE', 'OTHER'] as const;

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsIn(SEXES)
  sex?: (typeof SEXES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ValidateIf((o) => o.email !== undefined && o.email !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string;

  /** When true, records an initial data-processing consent on registration. */
  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}

export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsIn(SEXES)
  sex?: (typeof SEXES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ValidateIf((o) => o.email !== undefined && o.email !== '')
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string;
}

export class ArchivePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500)
  reason!: string;
}

export class ConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  purpose!: string;
}

export class AllergyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  substance!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class HistoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;
}
