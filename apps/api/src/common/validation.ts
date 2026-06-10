import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Required reason field for destructive actions. Trims the value first so a
 * whitespace-only string is rejected with 400, not silently accepted —
 * `@IsNotEmpty` alone lets "   " through.
 */
export function IsReason(maxLength = 500): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    IsNotEmpty({ message: 'reason is required' }),
    MaxLength(maxLength),
  );
}
