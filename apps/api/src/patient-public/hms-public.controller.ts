import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { PERMISSIONS } from '@hms/db';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { HmsPublicService } from './hms-public.service';
import {
  CreateAppointmentTypeDto,
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  CreateDoctorProfileDto,
  HideReasonDto,
  HospitalProfileDto,
  LinkBookingPatientDto,
  PortalSettingsDto,
  RejectBookingDto,
  RescheduleBookingDto,
  UpdateAppointmentTypeDto,
  UpdateAvailabilityRuleDto,
  UpdateDoctorProfileDto,
} from './dto';

const P = PERMISSIONS;
// Read endpoints accept any of the manage perms or the read perm.
const READ = [P.PUBLIC_PROFILE_READ, P.PUBLIC_PROFILE_MANAGE, P.DOCTOR_PUBLIC_PROFILE_MANAGE, P.APPOINTMENT_TYPE_MANAGE, P.AVAILABILITY_MANAGE, P.PATIENT_PORTAL_SETTINGS_MANAGE];

/**
 * Phase 22.2 — HMS staff admin controls for the public patient layer.
 * Permission-gated, tenant-scoped (RLS via ctx.db), audited. No @RequireModule:
 * the patient portal is enabled per-tenant via PatientPortalSettings, not a plan module.
 */
@Controller('hms')
export class HmsPublicController {
  constructor(private readonly svc: HmsPublicService) {}

  // ── Patient portal settings ─────────────────────────────────
  @Get('patient-portal/settings')
  @RequirePermission(...READ)
  getPortalSettings(@Ctx() ctx: RequestContext) {
    return this.svc.getPortalSettings(ctx);
  }

  @Put('patient-portal/settings')
  @RequirePermission(P.PATIENT_PORTAL_SETTINGS_MANAGE)
  updatePortalSettings(@Ctx() ctx: RequestContext, @Body() dto: PortalSettingsDto) {
    return this.svc.updatePortalSettings(ctx, dto);
  }

  // ── Public hospital profile ─────────────────────────────────
  @Get('public-profile')
  @RequirePermission(...READ)
  getHospitalProfile(@Ctx() ctx: RequestContext) {
    return this.svc.getHospitalProfile(ctx);
  }

  @Put('public-profile')
  @RequirePermission(P.PUBLIC_PROFILE_MANAGE)
  updateHospitalProfile(@Ctx() ctx: RequestContext, @Body() dto: HospitalProfileDto) {
    return this.svc.updateHospitalProfile(ctx, dto);
  }

  @Post('public-profile/publish')
  @RequirePermission(P.PUBLIC_PROFILE_MANAGE)
  publishHospitalProfile(@Ctx() ctx: RequestContext) {
    return this.svc.publishHospitalProfile(ctx);
  }

  @Post('public-profile/hide')
  @RequirePermission(P.PUBLIC_PROFILE_MANAGE)
  hideHospitalProfile(@Ctx() ctx: RequestContext, @Body() dto: HideReasonDto) {
    return this.svc.hideHospitalProfile(ctx, dto.reason);
  }

  // ── Public doctor profiles ──────────────────────────────────
  @Get('public-doctor-profiles')
  @RequirePermission(...READ)
  listDoctorProfiles(@Ctx() ctx: RequestContext) {
    return this.svc.listDoctorProfiles(ctx);
  }

  @Post('public-doctor-profiles')
  @RequirePermission(P.DOCTOR_PUBLIC_PROFILE_MANAGE)
  createDoctorProfile(@Ctx() ctx: RequestContext, @Body() dto: CreateDoctorProfileDto) {
    return this.svc.createDoctorProfile(ctx, dto);
  }

  @Put('public-doctor-profiles/:id')
  @RequirePermission(P.DOCTOR_PUBLIC_PROFILE_MANAGE)
  updateDoctorProfile(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateDoctorProfileDto) {
    return this.svc.updateDoctorProfile(ctx, id, dto);
  }

  @Post('public-doctor-profiles/:id/publish')
  @RequirePermission(P.DOCTOR_PUBLIC_PROFILE_MANAGE)
  publishDoctorProfile(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.publishDoctorProfile(ctx, id);
  }

  @Post('public-doctor-profiles/:id/hide')
  @RequirePermission(P.DOCTOR_PUBLIC_PROFILE_MANAGE)
  hideDoctorProfile(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: HideReasonDto) {
    return this.svc.hideDoctorProfile(ctx, id, dto.reason);
  }

  // ── Appointment types ───────────────────────────────────────
  @Get('appointment-types')
  @RequirePermission(...READ)
  listAppointmentTypes(@Ctx() ctx: RequestContext) {
    return this.svc.listAppointmentTypes(ctx);
  }

  @Post('appointment-types')
  @RequirePermission(P.APPOINTMENT_TYPE_MANAGE)
  createAppointmentType(@Ctx() ctx: RequestContext, @Body() dto: CreateAppointmentTypeDto) {
    return this.svc.createAppointmentType(ctx, dto);
  }

  @Patch('appointment-types/:id')
  @RequirePermission(P.APPOINTMENT_TYPE_MANAGE)
  updateAppointmentType(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateAppointmentTypeDto) {
    return this.svc.updateAppointmentType(ctx, id, dto);
  }

  // ── Availability rules ──────────────────────────────────────
  @Get('availability-rules')
  @RequirePermission(...READ)
  listAvailabilityRules(@Ctx() ctx: RequestContext, @Query('doctorId') doctorId?: string) {
    return this.svc.listAvailabilityRules(ctx, doctorId);
  }

  @Post('availability-rules')
  @RequirePermission(P.AVAILABILITY_MANAGE)
  createAvailabilityRule(@Ctx() ctx: RequestContext, @Body() dto: CreateAvailabilityRuleDto) {
    return this.svc.createAvailabilityRule(ctx, dto);
  }

  @Patch('availability-rules/:id')
  @RequirePermission(P.AVAILABILITY_MANAGE)
  updateAvailabilityRule(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateAvailabilityRuleDto) {
    return this.svc.updateAvailabilityRule(ctx, id, dto);
  }

  // ── Availability overrides ──────────────────────────────────
  @Get('availability-overrides')
  @RequirePermission(...READ)
  listAvailabilityOverrides(@Ctx() ctx: RequestContext, @Query('doctorId') doctorId?: string) {
    return this.svc.listAvailabilityOverrides(ctx, doctorId);
  }

  @Post('availability-overrides')
  @RequirePermission(P.AVAILABILITY_MANAGE)
  createAvailabilityOverride(@Ctx() ctx: RequestContext, @Body() dto: CreateAvailabilityOverrideDto) {
    return this.svc.createAvailabilityOverride(ctx, dto);
  }

  // ── Online-booking queue ────────────────────────────────────
  @Get('online-bookings')
  @RequirePermission(P.ONLINE_BOOKING_READ, P.ONLINE_BOOKING_MANAGE)
  listOnlineBookings(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.svc.listOnlineBookings(ctx, status);
  }

  @Get('online-bookings/:id')
  @RequirePermission(P.ONLINE_BOOKING_READ, P.ONLINE_BOOKING_MANAGE)
  getOnlineBooking(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getOnlineBooking(ctx, id);
  }

  @Post('online-bookings/:id/approve')
  @RequirePermission(P.ONLINE_BOOKING_APPROVE, P.ONLINE_BOOKING_MANAGE)
  approveBooking(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.approveBooking(ctx, id);
  }

  @Post('online-bookings/:id/reject')
  @RequirePermission(P.ONLINE_BOOKING_REJECT, P.ONLINE_BOOKING_MANAGE)
  rejectBooking(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: RejectBookingDto) {
    return this.svc.rejectBooking(ctx, id, dto.reason);
  }

  @Post('online-bookings/:id/reschedule')
  @RequirePermission(P.ONLINE_BOOKING_RESCHEDULE, P.ONLINE_BOOKING_MANAGE)
  rescheduleBooking(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: RescheduleBookingDto) {
    return this.svc.rescheduleBooking(ctx, id, dto.date, dto.time);
  }

  @Post('online-bookings/:id/link-patient')
  @RequirePermission(P.ONLINE_BOOKING_MANAGE)
  linkBookingPatient(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: LinkBookingPatientDto) {
    return this.svc.linkBookingPatient(ctx, id, dto.patientId);
  }

  // ── Document visibility ─────────────────────────────────────
  @Post('patient-documents/:id/publish')
  @RequirePermission(P.PATIENT_DOCUMENT_PUBLISH)
  publishDocument(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.publishDocument(ctx, id);
  }

  @Post('patient-documents/:id/hide')
  @RequirePermission(P.PATIENT_DOCUMENT_HIDE)
  hideDocument(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: HideReasonDto) {
    return this.svc.hideDocument(ctx, id, dto.reason);
  }

  // ── Patient portal access management ────────────────────────
  @Get('patients/:patientId/portal-access')
  @RequirePermission(P.PATIENT_PORTAL_ACCESS_READ, P.PATIENT_PORTAL_ACCESS_MANAGE)
  listPortalAccess(@Ctx() ctx: RequestContext, @Param('patientId') patientId: string) {
    return this.svc.listPortalAccess(ctx, patientId);
  }

  @Post('portal-access/:id/block')
  @RequirePermission(P.PATIENT_PORTAL_ACCESS_MANAGE)
  blockPortalAccess(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: HideReasonDto) {
    return this.svc.blockPortalAccess(ctx, id, dto.reason);
  }

  @Post('portal-access/:id/revoke')
  @RequirePermission(P.PATIENT_PORTAL_ACCESS_MANAGE)
  revokePortalAccess(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: HideReasonDto) {
    return this.svc.revokePortalAccess(ctx, id, dto.reason);
  }

  @Post('portal-access/:id/reactivate')
  @RequirePermission(P.PATIENT_PORTAL_ACCESS_MANAGE)
  reactivatePortalAccess(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.reactivatePortalAccess(ctx, id);
  }

  @Get('portal-access/requests')
  @RequirePermission(P.PATIENT_PORTAL_ACCESS_READ, P.PATIENT_PORTAL_ACCESS_MANAGE)
  listAccessRequests(@Ctx() ctx: RequestContext) {
    return this.svc.listAccessRequests(ctx);
  }

  @Post('portal-access/:id/approve')
  @RequirePermission(P.PATIENT_PORTAL_ACCESS_MANAGE)
  approveAccessRequest(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.approveAccessRequest(ctx, id);
  }
}
