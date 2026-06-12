import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSIONS } from '@hms/db';
import { HmsPublicService } from '../src/patient-public/hms-public.service';
import { HmsPublicController } from '../src/patient-public/hms-public.controller';
import { HideReasonDto, CreateAvailabilityRuleDto, RejectBookingDto } from '../src/patient-public/dto';
import { AuditService } from '../src/common/audit.service';
import { PERMISSION_KEY } from '../src/common/decorators';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'new' }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({ id: 'ps1' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
  };
}

function db(): Record<string, any> {
  return {
    tenant: model(),
    provider: model(),
    patientPortalSettings: model(),
    publicHospitalProfile: model(),
    publicDoctorProfile: model(),
    appointmentType: model(),
    availabilityRule: model(),
    availabilityOverride: model(),
    publicSearchIndex: model(),
    onlineBooking: model(),
    appointment: model(),
    patient: model(),
    patientDocument: model(),
    patientPortalAccess: model(),
    prescriptionRefillRequest: model(),
  };
}

function ctx(d: Record<string, any>): RequestContext {
  return { ...emptyContext(), userId: 'u1', tenantId: 't1', db: d as any };
}

const asAudit = (a: any) => a as unknown as AuditService;

let d: Record<string, any>;
let audit: { log: jest.Mock };
let index: { syncHospital: jest.Mock; syncDoctor: jest.Mock };
let notify: { notifyUid: jest.Mock; notifyPatientRecord: jest.Mock };
let svc: HmsPublicService;

beforeEach(() => {
  d = db();
  audit = { log: jest.fn().mockResolvedValue(undefined) };
  index = { syncHospital: jest.fn().mockResolvedValue(undefined), syncDoctor: jest.fn().mockResolvedValue(undefined) };
  notify = {
    notifyUid: jest.fn().mockResolvedValue(undefined),
    notifyPatientRecord: jest.fn().mockResolvedValue(undefined),
  };
  svc = new HmsPublicService(asAudit(audit), index as any, notify as any);
});

describe('HMS public admin — gating & DTOs', () => {
  it('write endpoints require the right permissions', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, HmsPublicController.prototype.updateHospitalProfile)).toContain(
      PERMISSIONS.PUBLIC_PROFILE_MANAGE,
    );
    expect(Reflect.getMetadata(PERMISSION_KEY, HmsPublicController.prototype.updatePortalSettings)).toContain(
      PERMISSIONS.PATIENT_PORTAL_SETTINGS_MANAGE,
    );
    expect(Reflect.getMetadata(PERMISSION_KEY, HmsPublicController.prototype.createDoctorProfile)).toContain(
      PERMISSIONS.DOCTOR_PUBLIC_PROFILE_MANAGE,
    );
  });

  it('hiding a profile requires a non-empty reason', async () => {
    expect((await validate(plainToInstance(HideReasonDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(HideReasonDto, { reason: 'No longer accepting online patients' }))).length,
    ).toBe(0);
  });
});

describe('Patient portal settings', () => {
  it('returns existing settings or creates defaults', async () => {
    d.patientPortalSettings.findUnique.mockResolvedValue(null);
    d.patientPortalSettings.create.mockResolvedValue({ id: 'ps1', enabled: false });
    const out = await svc.getPortalSettings(ctx(d));
    expect(d.patientPortalSettings.create).toHaveBeenCalled();
    expect(out.id).toBe('ps1');
  });

  it('updating settings upserts and audits', async () => {
    d.patientPortalSettings.upsert.mockResolvedValue({ id: 'ps1', enabled: true, onlineBookingEnabled: true });
    await svc.updatePortalSettings(ctx(d), { enabled: true, onlineBookingEnabled: true });
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'patient_portal.settings.update' }),
    );
  });
});

describe('Public hospital profile', () => {
  it('creates a profile with a generated slug and syncs the search index', async () => {
    d.publicHospitalProfile.findUnique.mockResolvedValue(null);
    d.tenant.findUnique.mockResolvedValue({ name: 'City Hospital' });
    d.publicHospitalProfile.create.mockResolvedValue({
      id: 'hp1',
      hospitalSlug: 'city-hospital-t1',
      hospitalDisplayName: 'City Hospital',
    });
    await svc.updateHospitalProfile(ctx(d), { city: 'Pune' });
    const created = d.publicHospitalProfile.create.mock.calls[0][0].data;
    expect(created.hospitalSlug).toMatch(/^city-hospital-/);
    expect(index.syncHospital).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'public_profile.update' }),
    );
  });

  it('publish requires an existing profile, sets PUBLISHED, syncs index, audits', async () => {
    d.publicHospitalProfile.findUnique.mockResolvedValue(null);
    await expect(svc.publishHospitalProfile(ctx(d))).rejects.toBeInstanceOf(BadRequestException);

    d.publicHospitalProfile.findUnique.mockResolvedValue({ id: 'hp1' });
    d.publicHospitalProfile.update.mockResolvedValue({
      id: 'hp1',
      isPublic: true,
      profileStatus: 'PUBLISHED',
      hospitalDisplayName: 'City',
    });
    await svc.publishHospitalProfile(ctx(d));
    expect(d.publicHospitalProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPublic: true, profileStatus: 'PUBLISHED' } }),
    );
    expect(index.syncHospital).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'public_profile.publish' }),
    );
  });
});

describe('Public doctor profile', () => {
  it('rejects when the provider does not exist', async () => {
    d.provider.findFirst.mockResolvedValue(null);
    await expect(
      svc.createDoctorProfile(ctx(d), { doctorId: '11111111-1111-4111-8111-111111111111', displayName: 'Dr A' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates with a slug and audits; publish syncs the doctor into the index', async () => {
    d.provider.findFirst.mockResolvedValue({ id: 'doc1' });
    d.publicDoctorProfile.findFirst.mockResolvedValueOnce(null); // no existing profile
    d.publicDoctorProfile.create.mockResolvedValue({ id: 'dp1', doctorId: 'doc1' });
    await svc.createDoctorProfile(ctx(d), { doctorId: 'doc1', displayName: 'Dr Asha Rao' } as any);
    expect(d.publicDoctorProfile.create.mock.calls[0][0].data.doctorSlug).toMatch(/^dr-asha-rao-/);
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'doctor_public_profile.create' }),
    );

    d.publicDoctorProfile.findFirst.mockResolvedValue({ id: 'dp1', doctorId: 'doc1' });
    d.publicDoctorProfile.update.mockResolvedValue({
      id: 'dp1',
      doctorId: 'doc1',
      isPublic: true,
      profileStatus: 'PUBLISHED',
    });
    d.publicHospitalProfile.findUnique.mockResolvedValue({ hospitalDisplayName: 'City' });
    await svc.publishDoctorProfile(ctx(d), 'dp1');
    expect(index.syncDoctor).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'doctor_public_profile.publish' }),
    );
  });
});

describe('Appointment types & availability', () => {
  it('creates an appointment type and audits', async () => {
    d.appointmentType.create.mockResolvedValue({ id: 'at1', name: 'GP Consult' });
    await svc.createAppointmentType(ctx(d), { name: 'GP Consult' } as any);
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'appointment_type.create' }),
    );
  });

  it('rejects an availability rule whose endTime is not after startTime', async () => {
    await expect(
      svc.createAvailabilityRule(ctx(d), {
        doctorId: 'doc1',
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '09:00',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a valid availability rule and audits', async () => {
    d.availabilityRule.create.mockResolvedValue({ id: 'ar1' });
    await svc.createAvailabilityRule(ctx(d), {
      doctorId: 'doc1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
    } as any);
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'availability.create' }),
    );
  });

  it('availability rule DTO requires day/time fields', async () => {
    const errs = await validate(plainToInstance(CreateAvailabilityRuleDto, { doctorId: 'x' }));
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('Online-booking queue (Phase 22.4b)', () => {
  it('approve sets CONFIRMED/APPROVED and audits — only for pending', async () => {
    d.onlineBooking.findFirst.mockResolvedValue({
      id: 'b1',
      bookingStatus: 'PENDING',
      appointmentId: 'a1',
      appointmentDate: new Date('2026-06-15T00:00:00.000Z'),
      appointmentTime: '10:00',
      uid: 'portal-uid-1',
    });
    d.onlineBooking.update.mockResolvedValue({ id: 'b1', bookingStatus: 'CONFIRMED' });
    await svc.approveBooking(ctx(d), 'b1');
    expect(d.onlineBooking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { bookingStatus: 'CONFIRMED', approvalStatus: 'APPROVED' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'online_booking.approve' }),
    );
    expect(notify.notifyUid).toHaveBeenCalledWith(
      'portal-uid-1',
      expect.objectContaining({ category: 'BOOKING', title: 'Booking confirmed' }),
    );

    d.onlineBooking.findFirst.mockResolvedValue({ id: 'b1', bookingStatus: 'CONFIRMED' });
    await expect(svc.approveBooking(ctx(d), 'b1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reject requires a reason, cancels the appointment, and audits', async () => {
    expect((await validate(plainToInstance(RejectBookingDto, { reason: '' }))).length).toBeGreaterThan(0);
    d.onlineBooking.findFirst.mockResolvedValue({ id: 'b1', bookingStatus: 'PENDING', appointmentId: 'a1' });
    await svc.rejectBooking(ctx(d), 'b1', 'Doctor unavailable that day');
    expect(d.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED', cancellationReason: 'Doctor unavailable that day' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'online_booking.reject' }),
    );
  });

  it('link-patient re-points booking + appointment to an existing patient and audits', async () => {
    d.onlineBooking.findFirst.mockResolvedValue({
      id: 'b1',
      appointmentId: 'a1',
      patientId: 'auto1',
      possibleDuplicatePatient: true,
      duplicatePatientIds: [],
    });
    d.patient.findFirst.mockResolvedValue({ id: 'existing1', fullName: 'Asha' });
    await svc.linkBookingPatient(ctx(d), 'b1', 'existing1');
    expect(d.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: { patientId: 'existing1' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'patient_record.linked_to_portal' }),
    );
  });

  it('link-patient rejects an unknown patient', async () => {
    d.onlineBooking.findFirst.mockResolvedValue({ id: 'b1', appointmentId: 'a1' });
    d.patient.findFirst.mockResolvedValue(null);
    await expect(svc.linkBookingPatient(ctx(d), 'b1', 'nope')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Document visibility & portal access (Phase 22.6)', () => {
  it('publish makes a document visible to the patient and audits', async () => {
    d.patientDocument.findFirst.mockResolvedValue({ id: 'doc1', patientId: 'p1' });
    await svc.publishDocument(ctx(d), 'doc1');
    expect(d.patientDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ visibleToPatient: true }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'document.publish_to_patient' }),
    );
  });

  it('hide removes patient visibility with a reason and audits', async () => {
    d.patientDocument.findFirst.mockResolvedValue({ id: 'doc1', patientId: 'p1' });
    await svc.hideDocument(ctx(d), 'doc1', 'Uploaded in error');
    expect(d.patientDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ visibleToPatient: false }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'document.hide_from_patient' }),
    );
  });

  it('block portal access sets BLOCKED + audits', async () => {
    d.patientPortalAccess.findFirst.mockResolvedValue({ id: 'acc1' });
    await svc.blockPortalAccess(ctx(d), 'acc1', 'Suspected misuse');
    expect(d.patientPortalAccess.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessStatus: 'BLOCKED', blockReason: 'Suspected misuse' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'patient_portal_access.block' }),
    );
  });

  it('revoke portal access sets REVOKED + audits', async () => {
    d.patientPortalAccess.findFirst.mockResolvedValue({ id: 'acc1' });
    await svc.revokePortalAccess(ctx(d), 'acc1', 'Patient requested removal');
    expect(d.patientPortalAccess.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { accessStatus: 'REVOKED', revokeReason: 'Patient requested removal' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'patient_portal_access.revoke' }),
    );
  });
});

describe('Prescription refill staff queue', () => {
  it('updates refill status, audits, and notifies the requesting patient', async () => {
    d.prescriptionRefillRequest.findFirst.mockResolvedValue({ id: 'refill-1', uid: 'portal-uid-1' });
    d.prescriptionRefillRequest.update.mockResolvedValue({ id: 'refill-1', status: 'APPROVED' });

    await svc.updateRefillStatus(ctx(d), 'refill-1', { status: 'APPROVED' });

    expect(d.prescriptionRefillRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'APPROVED', staffNote: null } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'prescription_refill.update' }),
    );
    expect(notify.notifyUid).toHaveBeenCalledWith(
      'portal-uid-1',
      expect.objectContaining({ category: 'REFILL', title: 'Refill approved', tenantId: 't1' }),
    );
  });

  it('requires a staff reason when rejecting a refill request', async () => {
    d.prescriptionRefillRequest.findFirst.mockResolvedValue({ id: 'refill-1', uid: 'portal-uid-1' });

    await expect(svc.updateRefillStatus(ctx(d), 'refill-1', { status: 'REJECTED' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(d.prescriptionRefillRequest.update).not.toHaveBeenCalled();
  });
});
