// Firebase is mocked so the client never loads the real SDK.
jest.mock('@/lib/firebase', () => ({
  getFirebaseIdToken: jest.fn(),
}));

import { buildHeaders } from '@/lib/api';
import { getFirebaseIdToken } from '@/lib/firebase';

const mockToken = getFirebaseIdToken as jest.Mock;

describe('api client buildHeaders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches the Firebase bearer token', async () => {
    mockToken.mockResolvedValue('tok-123');
    const h = await buildHeaders();
    expect(h['Authorization']).toBe('Bearer tok-123');
  });

  it('omits Authorization when there is no token', async () => {
    mockToken.mockResolvedValue(null);
    const h = await buildHeaders();
    expect(h['Authorization']).toBeUndefined();
  });

  it('attaches tenant context for tenant-scoped calls', async () => {
    mockToken.mockResolvedValue('tok-123');
    const h = await buildHeaders('tenant-9', true);
    expect(h['X-Tenant-Id']).toBe('tenant-9');
    expect(h['Content-Type']).toBe('application/json');
    expect(h['Authorization']).toBe('Bearer tok-123');
  });

  it('does not attach a tenant header when no tenant is given', async () => {
    mockToken.mockResolvedValue('tok-123');
    const h = await buildHeaders();
    expect(h['X-Tenant-Id']).toBeUndefined();
    expect(h['Content-Type']).toBeUndefined();
  });
});
