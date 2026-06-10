import fs from 'node:fs';
import path from 'node:path';

const calls: { fn: string; path: string; body: unknown; tenant: unknown }[] = [];

jest.mock('@/lib/api', () => ({
  apiGet: (path: string, tenant: unknown) => {
    calls.push({ fn: 'apiGet', path, body: undefined, tenant });
    return Promise.resolve([]);
  },
  apiPost: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiPost', path, body, tenant });
    return Promise.resolve({});
  },
  apiPatch: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiPatch', path, body, tenant });
    return Promise.resolve({});
  },
}));

import { patientsApi } from '@/lib/patients';
import { staffApi } from '@/lib/staff';

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

describe('patient document client wiring', () => {
  it('lists, attaches, and generates patient documents with tenant scope', async () => {
    await patientsApi.listDocuments('t1', 'p1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/patients/p1/documents', tenant: 't1' });

    await patientsApi.attachDocument('t1', 'p1', {
      title: 'Outside report',
      category: 'LAB',
      mimeType: 'application/pdf',
      fileName: 'report.pdf',
      documentUrl: 'data:application/pdf;base64,abc',
      notes: 'Uploaded by reception',
    });
    expect(last()).toMatchObject({
      fn: 'apiPost',
      path: '/patients/p1/documents',
      tenant: 't1',
      body: expect.objectContaining({ title: 'Outside report', category: 'LAB' }),
    });

    await patientsApi.generateSummaryDocument('t1', 'p1', { title: 'Patient summary' });
    expect(last()).toMatchObject({
      fn: 'apiPost',
      path: '/patients/p1/documents/summary',
      tenant: 't1',
      body: { title: 'Patient summary' },
    });
  });
});

describe('staff temporary password client wiring', () => {
  it('sends an optional temporary password during staff invite', async () => {
    await staffApi.invite('t1', {
      fullName: 'Temp User',
      email: 'temp@h.org',
      roles: ['RECEPTION'],
      temporaryPassword: 'Aa1!temporary',
    });

    expect(last()).toMatchObject({
      fn: 'apiPost',
      path: '/staff',
      tenant: 't1',
      body: expect.objectContaining({ temporaryPassword: 'Aa1!temporary' }),
    });
  });
});

describe('account settings route', () => {
  it('contains the Firebase password change and API clear-flag flow', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'src/app/settings/account/page.tsx'), 'utf8');
    expect(text).toContain('updatePassword');
    expect(text).toContain('/auth/password-changed');
  });

  it('sidebar settings link opens account settings', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'src/components/app-shell.tsx'), 'utf8');
    expect(text).toContain('href="/settings/account"');
  });
});
