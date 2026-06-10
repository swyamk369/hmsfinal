/**
 * Phase 15 - Notifications route protection and API client wiring.
 */
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
}));

import { routeDecision } from '@/lib/access';
import { notificationsApi } from '@/lib/notifications';
import type { Membership, Profile } from '@/lib/types';

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

describe('Phase 15 notification API wrappers', () => {
  it('loads notification lists, counts, and preferences', async () => {
    await notificationsApi.list('t1', { read: 'unread', category: 'LAB', severity: '' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/notifications?read=unread&category=LAB', tenant: 't1' });

    await notificationsApi.unreadCount('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/notifications/unread-count' });

    await notificationsApi.preferences('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/notifications/preferences' });
  });

  it('marks read, reads all, archives, and saves preferences', async () => {
    await notificationsApi.markRead('t1', 'n1');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/notifications/n1/read' });

    await notificationsApi.readAll('t1');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/notifications/read-all' });

    await notificationsApi.archive('t1', 'n1');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/notifications/n1/archive' });

    await notificationsApi.updatePreferences('t1', [{ id: null, category: 'LAB', inAppEnabled: true, emailEnabled: true, smsEnabled: false, whatsappEnabled: false }]);
    expect(last()).toMatchObject({
      fn: 'apiPost',
      path: '/notifications/preferences',
      body: { preferences: [{ id: null, category: 'LAB', inAppEnabled: true, emailEnabled: true, smsEnabled: false, whatsappEnabled: false }] },
    });
  });
});

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['RECEPTION'],
    permissions: [],
    modules: [],
    providerId: null,
    ...over,
  };
}

function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

describe('Phase 15 route protection', () => {
  it('notifications and notification settings are available to authenticated tenant users without module entitlement', () => {
    const m = membership();
    const p = profile(m);
    expect(routeDecision(p, m, {})).toBeNull();
  });

  it('tenant suspension still blocks notifications through the common protected route rules', () => {
    const m = membership({ status: 'SUSPENDED' });
    expect(routeDecision(profile(m), m, {})).toBe('/tenant-suspended');
  });
});

describe('Phase 15 notification UI is real', () => {
  it('removes the old later-phase notification placeholder copy', () => {
    const files = [
      'src/components/app-shell.tsx',
      'src/components/notification-bell.tsx',
      'src/app/notifications/page.tsx',
      'src/app/settings/notifications/page.tsx',
    ];
    for (const file of files) {
      const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(text).not.toContain('arrive in a later phase');
      expect(text).not.toContain('No notifications yet');
      expect(text).not.toContain('mock');
    }
  });
});
