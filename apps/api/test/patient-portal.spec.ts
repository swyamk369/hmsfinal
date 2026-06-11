import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

let tdb: Record<string, any>;
jest.mock('@hms/db', () => ({ ...jest.requireActual('@hms/db'), platformDb: {}, forTenant: () => tdb }));

import { platformDb } from '@hms/db';
import { PatientPortalService } from '../src/patient-public/patient-portal.service';
import { FirebaseService } from '../src/common/firebase.service';
import { AuditService } from '../src/common/audit.service';

function model() {
  return { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) };
}

const pdb = platformDb as any;
let firebase: { verifyIdToken: jest.Mock };
let audit: { log: jest.Mock };
let svc: PatientPortalService;
const TOKEN = 'Bearer valid-token';

beforeEach(() => {
  Object.assign(pdb, { patientAuthUser: model(), patientPortalAccess: model(), publicHospitalProfile: model(), patientPortalSettings: model() });
  tdb = { patient: model(), appointment: model(), bill: model(), patientDocument: model(), labOrder: model(), provider: model(), prescription: model() };
  firebase = { verifyIdToken: jest.fn().mockResolvedValue({ uid: 'u1', email: 'p@x.com' }) };
  audit = { log: jest.fn().mockResolvedValue(undefined) };
  svc = new PatientPortalService(firebase as unknown as FirebaseService, audit as unknown as AuditService);
});

describe('Patient portal — auth', () => {
  it('rejects a request with no bearer token', async () => {
    await expect(svc.me(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid/expired token', async () => {
    firebase.verifyIdToken.mockResolvedValue(null);
    await expect(svc.me(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('me() verifies the token and registers/refreshes the PatientAuthUser', async () => {
    pdb.patientAuthUser.findUnique.mockResolvedValue({ uid: 'u1', email: 'p@x.com', displayName: 'Priya' });
    const out = await svc.me(TOKEN);
    expect(pdb.patientAuthUser.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { uid: 'u1' } }));
    expect(out.uid).toBe('u1');
  });
});

describe('Patient portal — tenant isolation', () => {
  it('denies access to a hospital the patient is not linked to (URL tampering)', async () => {
    pdb.patientPortalAccess.findFirst.mockResolvedValue(null); // no ACTIVE access for this tenant
    await expect(svc.dashboard(TOKEN, 'other-tenant')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes records to the linked patient and only shows visible documents', async () => {
    pdb.patientPortalAccess.findFirst.mockResolvedValue({ patientId: 'p1', tenantId: 't1', accessStatus: 'ACTIVE' });
    await svc.documents(TOKEN, 't1');
    const where = tdb.patientDocument.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ patientId: 'p1', visibleToPatient: true });
  });

  it('linked-hospitals lists only ACTIVE access links', async () => {
    pdb.patientPortalAccess.findMany.mockResolvedValue([{ tenantId: 't1', patientId: 'p1', hospitalDisplayName: 'Demo' }]);
    pdb.publicHospitalProfile.findMany.mockResolvedValue([{ tenantId: 't1', hospitalDisplayName: 'Demo Hospital', city: 'Pune' }]);
    const out = await svc.linkedHospitals(TOKEN);
    expect(pdb.patientPortalAccess.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { uid: 'u1', accessStatus: 'ACTIVE' } }));
    expect(out[0]).toMatchObject({ tenantId: 't1', hospitalName: 'Demo Hospital' });
  });
});

describe('Patient portal — document view & request access (Phase 22.6)', () => {
  it('marking a document viewed audits patient.document_view', async () => {
    pdb.patientPortalAccess.findFirst.mockResolvedValue({ patientId: 'p1', tenantId: 't1', accessStatus: 'ACTIVE' });
    tdb.patientDocument.findFirst.mockResolvedValue({ id: 'doc1', patientId: 'p1', visibleToPatient: true, patientViewedAt: null });
    await svc.markDocumentViewed(TOKEN, 't1', 'doc1');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'patient.document_view' }));
  });

  it('request-access returns no_match when no patient matches', async () => {
    pdb.patientPortalSettings.findUnique.mockResolvedValue({ enabled: true });
    tdb.patient.findFirst.mockResolvedValue(null);
    const out = await svc.requestAccess(TOKEN, { tenantId: 't1', mrn: 'X-999' });
    expect(out.status).toBe('no_match');
  });

  it('request-access creates a PENDING link + audits when a patient matches', async () => {
    pdb.patientPortalSettings.findUnique.mockResolvedValue({ enabled: true });
    tdb.patient.findFirst.mockResolvedValue({ id: 'p9', dob: null });
    pdb.patientPortalAccess.findFirst.mockResolvedValue(null);
    const out = await svc.requestAccess(TOKEN, { tenantId: 't1', phone: '+9112345' });
    expect(out.status).toBe('requested');
    expect(pdb.patientPortalAccess.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accessStatus: 'PENDING' }) }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'patient_portal_access.requested' }));
  });
});
