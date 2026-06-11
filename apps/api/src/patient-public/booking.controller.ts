import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators';
import { BookingService } from './booking.service';
import { CreateBookingDto, ValidateSlotDto } from './dto';

/** Phase 22.4 — PUBLIC online booking. No auth; writes into the chosen tenant HMS. */
@Public()
@Controller('public/booking')
export class BookingController {
  constructor(private readonly svc: BookingService) {}

  @Get('options')
  options(@Query('tenantId') tenantId: string, @Query('doctorId') doctorId: string) {
    return this.svc.options(tenantId, doctorId);
  }

  @Get('slots')
  slots(
    @Query('tenantId') tenantId: string,
    @Query('doctorId') doctorId: string,
    @Query('from') from?: string,
    @Query('days') days = '14',
    @Query('appointmentTypeId') appointmentTypeId?: string,
  ) {
    return this.svc.slots(tenantId, doctorId, from, Number(days) || 14, appointmentTypeId);
  }

  @Post('validate-slot')
  validateSlot(@Body() dto: ValidateSlotDto) {
    return this.svc.validateSlot(dto.tenantId, dto.doctorId, dto.date, dto.time, dto.appointmentTypeId);
  }

  @Post('create')
  create(@Body() dto: CreateBookingDto) {
    return this.svc.create(dto);
  }

  @Get(':id/status')
  status(@Param('id') id: string) {
    return this.svc.status(id);
  }
}
