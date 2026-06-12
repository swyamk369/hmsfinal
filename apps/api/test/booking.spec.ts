import { BadRequestException } from '@nestjs/common';

let mockTx: Record<string, any>;
const mockTenantTransaction = jest.fn((_t: string, fn: (tx: any) => any) => fn(mockTx));
jest.mock('@hms/db', () => ({
  ...jest.requireActual('@hms/db'),
  platformDb: {},
  tenantTransaction: mockTenantTransaction,
}));

import { platformDb } from '@hms/db';
import { BookingService } from '../src/patient-public/booking.service';
import { AuditService } from '../src/common/audit.service';
import {
  daySlots,
  dateKey,
  wallClockToInstant,
  timeKeyInTz,
  dateKeyInTz,
  type SlotRule,
  type SlotPolicy,
} from '../src/patient-public/slots';

// ─── Slot engine (pure) ───────────────────────────────────────────
const rule = (over: Partial<SlotRule> = {}): SlotRule => ({
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '12:00',
  slotDurationMinutes: 15,
  bufferMinutes: 0,
  maxBookingsPerSlot: 1,
  isActive: true,
  ...over,
});
const policy: SlotPolicy = { minimumBookingNoticeHours: 2, maximumBookingAdvanceDays: 60, durationMinutes: 15 };

describe('slot engine — daySlots', () => {
  const now = new Date(2026, 5, 10, 8, 0);
  const target = new Date(2026, 5, 15);
  const dow = target.getDay();

  it('generates 15-minute slots across the window, all available', () => {
    const slots = daySlots({
      date: target,
      rules: [rule({ dayOfWeek: dow })],
      overrides: [],
      bookedCounts: {},
      policy,
      now,
    });
    expect(slots).toHaveLength(12);
    expect(slots[0].time).toBe('09:00');
    expect(slots.every((s) => s.available)).toBe(true);
  });
  it('returns nothing on a day with no matching rule', () => {
    expect(
      daySlots({
        date: target,
        rules: [rule({ dayOfWeek: (dow + 1) % 7 })],
        overrides: [],
        bookedCounts: {},
        policy,
        now,
      }),
    ).toHaveLength(0);
  });
  it('respects the minimum booking notice (same-day)', () => {
    const sameDayNow = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 9, 30);
    const slots = daySlots({
      date: target,
      rules: [rule({ dayOfWeek: dow })],
      overrides: [],
      bookedCounts: {},
      policy,
      now: sameDayNow,
    });
    expect(slots.filter((s) => s.available).map((s) => s.time)).toEqual(['11:30', '11:45']);
  });
  it('returns nothing beyond the advance window', () => {
    const far = new Date(now.getTime() + 61 * 86400000);
    expect(
      daySlots({ date: far, rules: [rule({ dayOfWeek: far.getDay() })], overrides: [], bookedCounts: {}, policy, now }),
    ).toHaveLength(0);
  });
  it('a whole-day block clears the day', () => {
    expect(
      daySlots({
        date: target,
        rules: [rule({ dayOfWeek: dow })],
        overrides: [{ date: dateKey(target), type: 'BLOCKED' }],
        bookedCounts: {},
        policy,
        now,
      }),
    ).toHaveLength(0);
  });
  it('a fully-booked slot is unavailable', () => {
    const slots = daySlots({
      date: target,
      rules: [rule({ dayOfWeek: dow })],
      overrides: [],
      bookedCounts: { '09:00': 1 },
      policy,
      now,
    });
    expect(slots.find((s) => s.time === '09:00')!.available).toBe(false);
  });
});

describe('timezone helpers', () => {
  it('converts a hospital wall-clock to the correct UTC instant (IST = UTC+5:30)', () => {
    const ms = wallClockToInstant('2026-06-13', '10:00', 'Asia/Kolkata');
    expect(new Date(ms).toISOString()).toBe('2026-06-13T04:30:00.000Z');
  });
  it('formats a UTC instant back to the hospital wall-clock', () => {
    expect(timeKeyInTz(new Date('2026-06-13T04:30:00.000Z'), 'Asia/Kolkata')).toBe('10:00');
    expect(dateKeyInTz(new Date('2026-06-12T20:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-06-13'); // 01:30 IST next day
  });
  it('falls back to local time when no timezone is given', () => {
    const ms = wallClockToInstant('2026-06-13', '10:00');
    expect(ms).toBe(new Date(2026, 5, 13, 10, 0).getTime());
  });
});

// ─── Booking service (mocked DB) ──────────────────────────────────
function model() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'x' }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
}
const pdb = platformDb as any;
let audit: { log: jest.Mock };
let notify: { notifyUid: jest.Mock };
let svc: BookingService;

function wire(portalOver: Record<string, any> = {}) {
  Object.assign(pdb, {
    tenant: model(),
    publicHospitalProfile: model(),
    publicDoctorProfile: model(),
    patientPortalSettings: model(),
    availabilityRule: model(),
    availabilityOverride: model(),
    appointment: model(),
    appointmentType: model(),
    onlineBooking: model(),
  });
  pdb.tenant.findUnique.mockResolvedValue({ status: 'ACTIVE', name: 'Demo' });
  pdb.publicHospitalProfile.findFirst.mockResolvedValue({
    tenantId: 't1',
    hospitalDisplayName: 'Demo Hospital',
    bookingEnabled: true,
  });
  pdb.publicDoctorProfile.findFirst.mockResolvedValue({
    tenantId: 't1',
    doctorId: 'doc1',
    displayName: 'Dr A',
    bookingEnabled: true,
    consultationTypes: ['IN_PERSON', 'TELEHEALTH'],
  });
  pdb.patientPortalSettings.findUnique.mockResolvedValue({
    enabled: true,
    onlineBookingEnabled: true,
    allowNewPatientBookings: true,
    allowExistingPatientBookings: true,
    bookingApprovalMode: 'AUTOMATIC',
    minimumBookingNoticeHours: 2,
    maximumBookingAdvanceDays: 60,
    ...portalOver,
  });
  pdb.availabilityRule.findMany.mockResolvedValue(
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: 15,
      bufferMinutes: 0,
      maxBookingsPerSlot: 1,
      isActive: true,
    })),
  );

  mockTx = {
    appointment: model(),
    patient: model(),
    hospitalSettings: model(),
    onlineBooking: model(),
    auditLog: model(),
  };
  mockTx.hospitalSettings.findUnique.mockResolvedValue({ mrnPrefix: 'MRN' });
  mockTx.patient.create.mockResolvedValue({ id: 'pat1', mrn: 'MRN-1' });
  mockTx.appointment.create.mockResolvedValue({ id: 'appt1' });
  mockTx.onlineBooking.create.mockResolvedValue({
    id: 'bk1',
    bookingStatus: portalOver.bookingApprovalMode === 'MANUAL' ? 'PENDING' : 'CONFIRMED',
    approvalStatus: portalOver.bookingApprovalMode === 'MANUAL' ? 'PENDING_STAFF_APPROVAL' : 'AUTO_CONFIRMED',
  });
}

function futureBooking(extra: Record<string, any> = {}) {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return {
    tenantId: 't1',
    doctorId: 'doc1',
    date: dateKey(d),
    time: '10:00',
    consultationType: 'IN_PERSON',
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    ...extra,
  } as any;
}

describe('booking service — create', () => {
  beforeEach(() => {
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    notify = { notifyUid: jest.fn().mockResolvedValue(undefined) };
    svc = new BookingService(audit as unknown as AuditService, notify as any);
    mockTenantTransaction.mockClear();
  });

  it('requires an email or mobile', async () => {
    wire();
    await expect(svc.create(futureBooking({ email: undefined, mobile: undefined }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when the hospital is not accepting online bookings', async () => {
    wire();
    pdb.publicHospitalProfile.findFirst.mockResolvedValue({ tenantId: 't1', bookingEnabled: false });
    await expect(svc.create(futureBooking())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('AUTOMATIC: confirms, creates patient + appointment + booking, audits online_book', async () => {
    wire({ bookingApprovalMode: 'AUTOMATIC' });
    const out = await svc.create(futureBooking());
    expect(mockTx.patient.create).toHaveBeenCalled();
    expect(mockTx.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'ONLINE_BOOKING', status: 'SCHEDULED' }) }),
    );
    expect(mockTx.onlineBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bookingStatus: 'CONFIRMED', approvalStatus: 'AUTO_CONFIRMED' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'appointment.online_book' }),
    );
    expect(out.requiresApproval).toBe(false);
  });

  it('stores portal uid and notifies signed-in patients after booking', async () => {
    wire({ bookingApprovalMode: 'AUTOMATIC' });
    await svc.create(futureBooking(), 'portal-uid-1');

    expect(mockTx.onlineBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ uid: 'portal-uid-1' }) }),
    );
    expect(notify.notifyUid).toHaveBeenCalledWith(
      'portal-uid-1',
      expect.objectContaining({ category: 'BOOKING', title: 'Booking confirmed', tenantId: 't1' }),
    );
  });

  it('MANUAL: stays pending staff approval', async () => {
    wire({ bookingApprovalMode: 'MANUAL' });
    const out = await svc.create(futureBooking());
    expect(out.requiresApproval).toBe(true);
    expect(mockTx.onlineBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvalStatus: 'PENDING_STAFF_APPROVAL' }) }),
    );
  });

  it('flags a possible duplicate patient without auto-merging, and audits it', async () => {
    wire();
    mockTx.patient.findMany.mockResolvedValue([{ id: 'existing1' }]);
    await svc.create(futureBooking());
    expect(mockTx.patient.create).toHaveBeenCalled(); // still creates a fresh record
    expect(mockTx.onlineBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ possibleDuplicatePatient: true }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'duplicate_patient.detected' }),
    );
  });

  it('rejects when the slot was just taken (in-transaction double-book guard)', async () => {
    wire();
    mockTx.appointment.count.mockResolvedValue(1);
    await expect(svc.create(futureBooking())).rejects.toBeInstanceOf(BadRequestException);
  });
});
