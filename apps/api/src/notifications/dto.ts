import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

export const NOTIFICATION_CATEGORIES = [
  'APPOINTMENT',
  'LAB',
  'BILLING',
  'PHARMACY',
  'INVENTORY',
  'INSURANCE',
  'IPD',
  'SYSTEM',
] as const;

export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;
export const NOTIFICATION_READ_FILTERS = ['all', 'read', 'unread'] as const;

export class NotificationQueryDto {
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: (typeof NOTIFICATION_CATEGORIES)[number];

  @IsOptional()
  @IsIn(NOTIFICATION_SEVERITIES)
  severity?: (typeof NOTIFICATION_SEVERITIES)[number];

  @IsOptional()
  @IsIn(NOTIFICATION_READ_FILTERS)
  read?: (typeof NOTIFICATION_READ_FILTERS)[number];

  @IsOptional()
  @IsString()
  archived?: string;
}

export class PreferenceEntryDto {
  @IsIn(NOTIFICATION_CATEGORIES)
  category!: (typeof NOTIFICATION_CATEGORIES)[number];

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietHoursStart?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietHoursEnd?: string;
}

export class UpdatePreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceEntryDto)
  preferences!: PreferenceEntryDto[];
}
