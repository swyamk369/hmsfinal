import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TENANT_ROLE_DEFS } from '@hms/db';

/** Role codes a Hospital Admin may assign (every tenant role; never SUPER_ADMIN). */
export const ASSIGNABLE_ROLE_CODES = TENANT_ROLE_DEFS.map((r) => r.code);

export class InviteStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ASSIGNABLE_ROLE_CODES, { each: true, message: 'unknown role code' })
  roles!: string[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  speciality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class UpdateRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ASSIGNABLE_ROLE_CODES, { each: true, message: 'unknown role code' })
  roles!: string[];

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class DeactivateStaffDto {
  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500)
  reason!: string;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  speciality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
