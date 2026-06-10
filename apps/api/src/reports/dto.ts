import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  billStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  itemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  transactionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  departmentId?: string;
}
