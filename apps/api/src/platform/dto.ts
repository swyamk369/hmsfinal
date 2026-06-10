import { IsReason } from '../common/validation';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PLAN_CODES, ALL_MODULES } from '@hms/db';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be lowercase letters, numbers, and hyphens' })
  slug!: string;

  @IsIn(Object.values(PLAN_CODES))
  planCode!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}

export class InviteAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;
}

export class ToggleModuleDto {
  @IsIn(ALL_MODULES)
  moduleCode!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class ReasonDto {
  @IsReason()
  reason!: string;
}
