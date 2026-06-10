import { IsReason } from '../common/validation';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DispenseLineDto {
  @IsOptional()
  @IsUUID()
  prescriptionItemId?: string;

  @IsUUID()
  inventoryItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DispenseDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DispenseLineDto)
  items!: DispenseLineDto[];
}

export class ReturnLineDto {
  @IsUUID()
  dispenseItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReturnDto {
  @IsUUID()
  dispenseRecordId!: string;

  @IsReason()
  reason!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items?: ReturnLineDto[];
}
