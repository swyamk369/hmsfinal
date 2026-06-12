import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators';
import { FirebaseService } from '../common/firebase.service';
import { platformDb } from '@hms/db';
import { BookingService } from './booking.service';
import { CreateBookingDto, ValidateSlotDto } from './dto';

/** Phase 22.4 — PUBLIC online booking. No auth; writes into the chosen tenant HMS. */
@Public()
@Controller('public/booking')
export class BookingController {
  constructor(
    private readonly svc: BookingService,
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * Optional identity capture: when a signed-in PORTAL patient books, attach
   * their uid to the booking so confirm/reject/reschedule notifications reach
   * them. Anonymous bookings stay fully supported. Never auto-links records.
   */
  private async resolvePortalUid(authorization?: string): Promise<string | null> {
    if (!authorization?.startsWith('Bearer ')) return null;
    const verified = await this.firebase.verifyIdToken(authorization.slice(7)).catch(() => null);
    if (!verified?.uid) return null;
    const portalUser = await platformDb.patientAuthUser.findUnique({ where: { uid: verified.uid } });
    return portalUser ? verified.uid : null;
  }

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
  async create(@Body() dto: CreateBookingDto, @Headers('authorization') authorization?: string) {
    const uid = await this.resolvePortalUid(authorization);
    return this.svc.create(dto, uid);
  }

  @Get(':id/status')
  status(@Param('id') id: string) {
    return this.svc.status(id);
  }
}
