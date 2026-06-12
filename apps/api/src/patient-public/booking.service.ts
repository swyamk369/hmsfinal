import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { platformDb, tenantTransaction } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { PatientNotifyService } from './patient-notify.service';
import { nextMrn } from '../common/sequences';
import {
  daySlots,
  dateKey,
  timeKeyInTz,
  wallClockToInstant,
  type SlotRule,
  type SlotOverride,
  type SlotPolicy,
} from './slots';
import type { CreateBookingDto } from './dto';

const DEFAULT_DURATION = 15;

@Injectable()
export class BookingService {
  constructor(
    private readonly audit: AuditService,
    private readonly notify: PatientNotifyService,
  ) {}

  // ── Public config validation (read via owner client, public filters) ──
  private async resolveContext(tenantId: string, doctorId: string) {
    const [tenant, hp, dp, portal] = await Promise.all([
      platformDb.tenant.findUnique({ where: { id: tenantId }, select: { status: true, name: true } }),
      platformDb.publicHospitalProfile.findFirst({
        where: { tenantId, isPublic: true, profileStatus: 'PUBLISHED' as any },
      }),
      platformDb.publicDoctorProfile.findFirst({
        where: { tenantId, doctorId, isPublic: true, profileStatus: 'PUBLISHED' as any },
      }),
      platformDb.patientPortalSettings.findUnique({ where: { tenantId } }),
    ]);
    if (!tenant || tenant.status !== 'ACTIVE')
      throw new BadRequestException('This hospital is not available right now.');
    if (!hp || !hp.bookingEnabled) throw new BadRequestException('This hospital is not accepting online bookings.');
    if (!portal?.enabled || !portal?.onlineBookingEnabled)
      throw new BadRequestException('Online booking is currently disabled for this hospital.');
    if (!dp || !dp.bookingEnabled) throw new BadRequestException('This doctor is not accepting online bookings.');
    return { tenant, hp, dp, portal };
  }

  private policy(portal: any, durationMinutes: number): SlotPolicy {
    return {
      minimumBookingNoticeHours: portal.minimumBookingNoticeHours ?? 2,
      maximumBookingAdvanceDays: portal.maximumBookingAdvanceDays ?? 60,
      durationMinutes,
    };
  }

  private async availability(
    tenantId: string,
    doctorId: string,
  ): Promise<{ rules: SlotRule[]; overrides: SlotOverride[] }> {
    const [rules, overrides] = await Promise.all([
      platformDb.availabilityRule.findMany({ where: { tenantId, doctorId, isActive: true } }),
      platformDb.availabilityOverride.findMany({ where: { tenantId, doctorId } }),
    ]);
    return {
      rules: rules.map((r: any) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        slotDurationMinutes: r.slotDurationMinutes,
        bufferMinutes: r.bufferMinutes,
        maxBookingsPerSlot: r.maxBookingsPerSlot,
        isActive: r.isActive,
      })),
      overrides: overrides.map((o: any) => ({
        date: dateKey(new Date(o.date)),
        type: o.type,
        startTime: o.startTime,
        endTime: o.endTime,
      })),
    };
  }

  private tzOf(portal: any): string {
    return portal?.timezone || 'Asia/Kolkata';
  }

  private async bookedCounts(
    tenantId: string,
    doctorId: string,
    day: Date,
    tz: string,
  ): Promise<Record<string, number>> {
    const key = dateKey(day);
    const start = new Date(wallClockToInstant(key, '00:00', tz));
    const end = new Date(start.getTime() + 86400000);
    const appts = await platformDb.appointment.findMany({
      where: {
        tenantId,
        providerId: doctorId,
        scheduledAt: { gte: start, lt: end },
        status: { notIn: ['CANCELLED'] as any },
      },
      select: { scheduledAt: true },
    });
    const counts: Record<string, number> = {};
    for (const a of appts) {
      const t = timeKeyInTz(a.scheduledAt, tz); // wall-clock in hospital tz
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }

  private async durationFor(tenantId: string, appointmentTypeId?: string): Promise<number> {
    if (!appointmentTypeId) return DEFAULT_DURATION;
    const t = await platformDb.appointmentType.findFirst({
      where: { tenantId, id: appointmentTypeId, isActive: true },
    });
    return t?.durationMinutes ?? DEFAULT_DURATION;
  }

  // ── Endpoints ─────────────────────────────────────────────────
  async options(tenantId: string, doctorId: string) {
    const { dp, hp } = await this.resolveContext(tenantId, doctorId);
    const types = await platformDb.appointmentType.findMany({
      where: { tenantId, isPublic: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    return {
      doctor: dp.displayName,
      specialty: dp.specialty ?? null,
      hospital: hp.hospitalDisplayName,
      consultationTypes: dp.consultationTypes?.length ? dp.consultationTypes : ['IN_PERSON'],
      appointmentTypes: types.map((t: any) => ({
        id: t.id,
        name: t.name,
        durationMinutes: t.durationMinutes,
        price: t.price,
        currency: t.currency,
        consultationType: t.consultationType,
      })),
    };
  }

  async slots(
    tenantId: string,
    doctorId: string,
    fromDate: string | undefined,
    days: number,
    appointmentTypeId?: string,
  ) {
    const { portal } = await this.resolveContext(tenantId, doctorId);
    const duration = await this.durationFor(tenantId, appointmentTypeId);
    const policy = this.policy(portal, duration);
    const tz = this.tzOf(portal);
    const { rules, overrides } = await this.availability(tenantId, doctorId);
    const now = new Date();
    const start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
    const out: { date: string; slots: { time: string; available: boolean }[] }[] = [];
    for (let i = 0; i < Math.min(days, 30); i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      day.setHours(0, 0, 0, 0);
      const counts = await this.bookedCounts(tenantId, doctorId, day, tz);
      const slots = daySlots({ date: day, rules, overrides, bookedCounts: counts, policy, now, timeZone: tz });
      if (slots.length) out.push({ date: dateKey(day), slots });
    }
    return out;
  }

  async validateSlot(
    tenantId: string,
    doctorId: string,
    date: string,
    time: string,
    appointmentTypeId?: string,
  ): Promise<{ available: boolean }> {
    const { portal } = await this.resolveContext(tenantId, doctorId);
    const duration = await this.durationFor(tenantId, appointmentTypeId);
    const policy = this.policy(portal, duration);
    const tz = this.tzOf(portal);
    const { rules, overrides } = await this.availability(tenantId, doctorId);
    const day = new Date(`${date}T00:00:00`);
    const counts = await this.bookedCounts(tenantId, doctorId, day, tz);
    const slots = daySlots({
      date: day,
      rules,
      overrides,
      bookedCounts: counts,
      policy,
      now: new Date(),
      timeZone: tz,
    });
    return { available: slots.some((s) => s.time === time && s.available) };
  }

  async create(dto: CreateBookingDto, portalUid: string | null = null) {
    if (!dto.email && !dto.mobile)
      throw new BadRequestException('Please provide an email or mobile number so the clinic can contact you.');
    const { hp, dp, portal } = await this.resolveContext(dto.tenantId, dto.doctorId);

    const isNew = (dto.newOrExistingPatient ?? 'NEW') === 'NEW';
    if (isNew && !portal.allowNewPatientBookings)
      throw new BadRequestException('This hospital is not accepting new-patient online bookings.');
    if (!isNew && !portal.allowExistingPatientBookings)
      throw new BadRequestException('This hospital is not accepting existing-patient online bookings.');

    // Server-side slot re-validation.
    const { available } = await this.validateSlot(
      dto.tenantId,
      dto.doctorId,
      dto.date,
      dto.time,
      dto.appointmentTypeId,
    );
    if (!available) throw new BadRequestException('That time slot is no longer available. Please choose another.');

    // Approval mode.
    const apptType = dto.appointmentTypeId
      ? await platformDb.appointmentType.findFirst({ where: { tenantId: dto.tenantId, id: dto.appointmentTypeId } })
      : null;
    const mode = portal.bookingApprovalMode;
    const requiresApproval = mode === 'MANUAL' || (mode === 'HYBRID' && (isNew || Boolean(apptType?.requiresApproval)));

    // Store the booked wall-clock time as the correct UTC instant for the hospital timezone.
    const scheduledAt = new Date(wallClockToInstant(dto.date, dto.time, this.tzOf(portal)));

    const result = await tenantTransaction(dto.tenantId, async (tx: any) => {
      // Final double-book guard inside the transaction.
      const clash = await tx.appointment.count({
        where: { providerId: dto.doctorId, scheduledAt, status: { notIn: ['CANCELLED'] } },
      });
      if (clash > 0) throw new BadRequestException('That time slot was just taken. Please choose another.');

      // Duplicate detection — flag, never auto-merge.
      const dupWhere: any[] = [];
      if (dto.email) dupWhere.push({ email: { equals: dto.email, mode: 'insensitive' } });
      if (dto.mobile) dupWhere.push({ phone: dto.mobile });
      if (dto.dateOfBirth)
        dupWhere.push({
          AND: [{ fullName: { equals: dto.fullName, mode: 'insensitive' } }, { dob: new Date(dto.dateOfBirth) }],
        });
      const dups = dupWhere.length
        ? await tx.patient.findMany({ where: { deletedAt: null, OR: dupWhere }, select: { id: true }, take: 5 })
        : [];
      const possibleDuplicate = dups.length > 0;

      // Always create a fresh tenant patient record for the booking (staff reconciles duplicates).
      const mrn = await nextMrn(tx, dto.tenantId);
      const patient = await tx.patient.create({
        data: {
          tenantId: dto.tenantId,
          mrn,
          fullName: dto.fullName,
          dob: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          phone: dto.mobile,
          email: dto.email,
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          tenantId: dto.tenantId,
          patientId: patient.id,
          providerId: dto.doctorId,
          scheduledAt,
          status: 'SCHEDULED',
          reason: dto.reasonForVisit,
          source: 'ONLINE_BOOKING',
          appointmentTypeId: dto.appointmentTypeId ?? null,
          locationId: dto.locationId ?? null,
          consultationType: dto.consultationType as any,
        },
      });

      const booking = await tx.onlineBooking.create({
        data: {
          tenantId: dto.tenantId,
          uid: portalUid,
          patientId: patient.id,
          doctorId: dto.doctorId,
          locationId: dto.locationId ?? null,
          appointmentTypeId: dto.appointmentTypeId ?? null,
          appointmentId: appointment.id,
          appointmentDate: new Date(dto.date),
          appointmentTime: dto.time,
          consultationType: dto.consultationType as any,
          reasonForVisit: dto.reasonForVisit,
          fullName: dto.fullName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          email: dto.email,
          mobile: dto.mobile,
          newOrExistingPatient: isNew ? 'NEW' : 'EXISTING',
          bookingStatus: requiresApproval ? 'PENDING' : 'CONFIRMED',
          approvalStatus: requiresApproval ? 'PENDING_STAFF_APPROVAL' : 'AUTO_CONFIRMED',
          possibleDuplicatePatient: possibleDuplicate,
          duplicatePatientIds: dups.map((d: any) => d.id),
        },
      });

      await this.audit.log(tx, {
        tenantId: dto.tenantId,
        actorId: null,
        action: 'appointment.online_book',
        entity: 'online_booking',
        entityId: booking.id,
        metadata: {
          doctorId: dto.doctorId,
          scheduledAt: scheduledAt.toISOString(),
          requiresApproval,
          source: 'ONLINE_BOOKING',
        },
      });
      if (possibleDuplicate) {
        await this.audit.log(tx, {
          tenantId: dto.tenantId,
          actorId: null,
          action: 'duplicate_patient.detected',
          entity: 'online_booking',
          entityId: booking.id,
          metadata: { candidates: dups.length },
        });
      }
      return { booking, possibleDuplicate };
    });

    // Real event → portal notification for signed-in patients (preference-aware).
    if (portalUid) {
      await this.notify
        .notifyUid(portalUid, {
          category: 'BOOKING',
          title: requiresApproval ? 'Booking request received' : 'Booking confirmed',
          body: requiresApproval
            ? `Your booking with ${dp.displayName} on ${dto.date} at ${dto.time} is awaiting hospital confirmation.`
            : `Your booking with ${dp.displayName} on ${dto.date} at ${dto.time} is confirmed.`,
          actionUrl: '/patient/appointments',
          tenantId: dto.tenantId,
        })
        .catch(() => undefined); // notification failure must never fail the booking
    }

    return {
      bookingId: result.booking.id,
      bookingStatus: result.booking.bookingStatus,
      approvalStatus: result.booking.approvalStatus,
      requiresApproval,
      hospital: hp.hospitalDisplayName,
      doctor: dp.displayName,
      date: dto.date,
      time: dto.time,
      consultationType: dto.consultationType,
    };
  }

  async status(bookingId: string) {
    const b = await platformDb.onlineBooking.findUnique({ where: { id: bookingId } });
    if (!b) throw new NotFoundException('Booking not found');
    const dp = await platformDb.publicDoctorProfile.findFirst({
      where: { tenantId: b.tenantId, doctorId: b.doctorId },
    });
    const hp = await platformDb.publicHospitalProfile.findFirst({ where: { tenantId: b.tenantId } });
    return {
      bookingId: b.id,
      bookingStatus: b.bookingStatus,
      approvalStatus: b.approvalStatus,
      date: dateKey(new Date(b.appointmentDate)),
      time: b.appointmentTime,
      consultationType: b.consultationType,
      doctor: dp?.displayName ?? null,
      hospital: hp?.hospitalDisplayName ?? null,
    };
  }
}
