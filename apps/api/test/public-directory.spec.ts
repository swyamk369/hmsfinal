import { NotFoundException } from '@nestjs/common';

jest.mock('@hms/db', () => ({ ...jest.requireActual('@hms/db'), platformDb: {} }));
import { platformDb, PERMISSIONS } from '@hms/db';
import { PublicService } from '../src/patient-public/public.service';
import { PublicController } from '../src/patient-public/public.controller';
import { HmsPublicController } from '../src/patient-public/hms-public.controller';
import { PUBLIC_KEY, PERMISSION_KEY } from '../src/common/decorators';

function model() {
  return {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  };
}

const pdb = platformDb as any;
let svc: PublicService;

beforeEach(() => {
  Object.assign(pdb, {
    publicSearchIndex: model(),
    publicHospitalProfile: model(),
    publicDoctorProfile: model(),
    appointmentType: model(),
  });
  svc = new PublicService();
});

describe('Public directory — access markers', () => {
  it('the public controller is @Public (no auth); the HMS admin controller is NOT', () => {
    expect(Reflect.getMetadata(PUBLIC_KEY, PublicController)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_KEY, HmsPublicController)).toBeUndefined();
  });
});

describe('Public directory — published-only & public-safe', () => {
  it('hospitals() queries the search index for HOSPITAL rows only', async () => {
    pdb.publicSearchIndex.findMany.mockResolvedValue([{ id: 'h1', type: 'HOSPITAL' }]);
    await svc.hospitals({ q: 'demo' });
    const where = pdb.publicSearchIndex.findMany.mock.calls[0][0].where;
    expect(where.type).toBe('HOSPITAL');
    expect(where.searchKeywords).toEqual({ contains: 'demo' });
  });

  it('hospitalBySlug filters to isPublic + PUBLISHED and returns a public-safe view', async () => {
    pdb.publicHospitalProfile.findFirst.mockResolvedValue({
      tenantId: 't1', hospitalSlug: 'demo', hospitalDisplayName: 'Demo', profileStatus: 'PUBLISHED', isPublic: true, services: ['Lab'], specialties: [],
    });
    pdb.publicDoctorProfile.findMany.mockResolvedValue([{ tenantId: 't1', doctorId: 'd1', doctorSlug: 'dr', displayName: 'Dr A' }]);
    pdb.appointmentType.findMany.mockResolvedValue([]);

    const out = await svc.hospitalBySlug('demo');
    const where = pdb.publicHospitalProfile.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ hospitalSlug: 'demo', isPublic: true, profileStatus: 'PUBLISHED' });
    expect(out.hospital).toMatchObject({ slug: 'demo', name: 'Demo', tenantId: 't1' });
    // public view must not leak internal status fields
    expect((out.hospital as any).profileStatus).toBeUndefined();
    expect(out.doctors[0]).toMatchObject({ slug: 'dr', name: 'Dr A', doctorId: 'd1' });
  });

  it('hospitalBySlug 404s when the hospital is missing or unpublished', async () => {
    pdb.publicHospitalProfile.findFirst.mockResolvedValue(null);
    await expect(svc.hospitalBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('doctorBySlug 404s when the doctor is missing or unpublished', async () => {
    pdb.publicDoctorProfile.findFirst.mockResolvedValue(null);
    await expect(svc.doctorBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('search() honors the type filter', async () => {
    await svc.search({ type: 'DOCTOR', specialty: 'cardio' });
    const where = pdb.publicSearchIndex.findMany.mock.calls[0][0].where;
    expect(where.type).toBe('DOCTOR');
    expect(where.specialty).toEqual({ contains: 'cardio', mode: 'insensitive' });
  });

  it('HMS admin controls require manage permissions (still private)', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, HmsPublicController.prototype.updateHospitalProfile)).toContain(PERMISSIONS.PUBLIC_PROFILE_MANAGE);
  });
});
