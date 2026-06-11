// Patient-portal API client. Uses the patient's own Firebase token (separate from staff).
import { getFirebaseIdToken } from './firebase';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function pget<T>(path: string, tenantId?: string): Promise<T> {
  const token = await getFirebaseIdToken();
  const url = `${API}${path}${tenantId ? `?tenantId=${tenantId}` : ''}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message || 'Something went wrong.');
  }
  return res.json();
}

async function ppost<T>(path: string, opts: { tenantId?: string; body?: unknown } = {}): Promise<T> {
  const token = await getFirebaseIdToken();
  const url = `${API}${path}${opts.tenantId ? `?tenantId=${opts.tenantId}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(opts.body ?? {}),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((Array.isArray(b.message) ? b.message.join(', ') : b.message) || 'Request failed.');
  }
  return res.json();
}

async function pmutate<T>(method: 'PATCH' | 'DELETE', path: string, opts: { tenantId?: string; body?: unknown } = {}): Promise<T> {
  const token = await getFirebaseIdToken();
  const url = `${API}${path}${opts.tenantId ? `?tenantId=${opts.tenantId}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(opts.body ?? {}),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((Array.isArray(b.message) ? b.message.join(', ') : b.message) || 'Request failed.');
  }
  return res.json();
}

export interface PortalMe {
  uid: string;
  email: string | null;
  displayName: string | null;
  mobile: string | null;
  profilePhotoUrl: string | null;
}
export interface LinkedHospital {
  tenantId: string;
  patientId: string;
  hospitalName: string;
  logoUrl: string | null;
  city: string | null;
}
export interface PortalAppointment {
  id: string;
  scheduledAt: string;
  status: string;
  reason: string | null;
  consultationType: string;
  source: string;
  doctorName: string | null;
}
export interface PortalBill {
  id: string;
  billNumber: string;
  netAmount: number;
  status: string;
  createdAt: string;
  paid: number;
  due: number;
  items: { name: string; quantity: number; total: number }[];
}
export interface PortalDocument {
  id: string;
  title: string;
  category: string;
  fileName: string | null;
  documentUrl: string;
  mimeType: string | null;
  publishedAt: string;
}
export interface PortalReport {
  id: string;
  createdAt: string;
  tests: { testName: string; results: { value: string | null; unit: string | null; referenceRange: string | null; abnormalFlag: string }[] }[];
}
export interface PortalDashboard {
  hospitalName: string;
  patient: { fullName: string; mrn: string } | null;
  upcoming: PortalAppointment | null;
  recentBill: (PortalBill & { payments?: unknown[] }) | null;
  recentDoc: PortalDocument | null;
}

export interface PortalPrescription {
  id: string;
  status: string;
  date: string;
  items: { drugName: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null }[];
}

// ── Phase 23: Care Team / Family / Notifications / Settings / Refills ──
export interface SavedProvider {
  id: string;
  tenantId: string;
  doctorId: string;
  doctorSlug: string | null;
  doctorName: string;
  specialty: string | null;
  hospitalName: string;
  photoUrl: string | null;
  createdAt: string;
}
export interface SavedHospital {
  id: string;
  tenantId: string;
  hospitalSlug: string | null;
  hospitalName: string;
  city: string | null;
  logoUrl: string | null;
  createdAt: string;
}
export interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  dob: string | null;
  sex: string | null;
  mobile: string | null;
  createdAt: string;
}
export interface PatientNotificationItem {
  id: string;
  tenantId: string | null;
  category: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface NotificationPrefs {
  notifyBookingUpdates: boolean;
  notifyDocuments: boolean;
  notifyBilling: boolean;
  notifyByEmail: boolean;
}
export interface PortalSettings {
  profile: { displayName: string | null; email: string | null; mobile: string | null; profilePhotoUrl: string | null };
  notifications: NotificationPrefs;
}
export interface RefillRequest {
  id: string;
  prescriptionId: string | null;
  status: string;
  note: string | null;
  staffNote: string | null;
  createdAt: string;
}
export interface ReportDetail {
  id: string;
  createdAt: string;
  status: string;
  tests: {
    testName: string;
    results: { testName: string; value: string | null; unit: string | null; referenceRange: string | null; abnormalFlag: string; notes: string | null; recordedAt: string }[];
  }[];
}

export const portalApi = {
  me: () => pget<PortalMe>('/patient-portal/me'),
  linkedHospitals: () => pget<LinkedHospital[]>('/patient-portal/linked-hospitals'),
  dashboard: (t: string) => pget<PortalDashboard>('/patient-portal/dashboard', t),
  appointments: (t: string) => pget<PortalAppointment[]>('/patient-portal/appointments', t),
  bills: (t: string) => pget<PortalBill[]>('/patient-portal/bills', t),
  reports: (t: string) => pget<PortalReport[]>('/patient-portal/reports', t),
  prescriptions: (t: string) => pget<PortalPrescription[]>('/patient-portal/prescriptions', t),
  documents: (t: string) => pget<PortalDocument[]>('/patient-portal/documents', t),
  profile: (t: string) =>
    pget<{ login: { displayName: string | null; email: string | null; mobile: string | null }; hospital: Record<string, any> }>('/patient-portal/profile', t),
  markDocumentViewed: (t: string, id: string) => ppost(`/patient-portal/documents/${id}/viewed`, { tenantId: t }),
  requestAccess: (body: { tenantId: string; mrn?: string; phone?: string; dob?: string }) =>
    ppost<{ status: 'requested' | 'no_match' | 'already_linked' }>('/patient-portal/request-access', { body }),

  // Care Team (saved providers / hospitals) — uid-scoped, no tenant
  savedProviders: () => pget<SavedProvider[]>('/patient-portal/saved-providers'),
  saveProvider: (body: { tenantId: string; doctorId: string; doctorSlug?: string; doctorName: string; specialty?: string; hospitalName: string; photoUrl?: string }) =>
    ppost<SavedProvider>('/patient-portal/saved-providers', { body }),
  removeSavedProvider: (id: string) => pmutate<{ ok: boolean }>('DELETE', `/patient-portal/saved-providers/${id}`),
  savedHospitals: () => pget<SavedHospital[]>('/patient-portal/saved-hospitals'),
  saveHospital: (body: { tenantId: string; hospitalSlug?: string; hospitalName: string; city?: string; logoUrl?: string }) =>
    ppost<SavedHospital>('/patient-portal/saved-hospitals', { body }),
  removeSavedHospital: (id: string) => pmutate<{ ok: boolean }>('DELETE', `/patient-portal/saved-hospitals/${id}`),

  // Family
  family: () => pget<FamilyMember[]>('/patient-portal/family'),
  addFamily: (body: { fullName: string; relationship: string; dob?: string; sex?: string; mobile?: string }) =>
    ppost<FamilyMember>('/patient-portal/family', { body }),
  updateFamily: (id: string, body: { fullName: string; relationship: string; dob?: string; sex?: string; mobile?: string }) =>
    pmutate<FamilyMember>('PATCH', `/patient-portal/family/${id}`, { body }),
  removeFamily: (id: string) => pmutate<{ ok: boolean }>('DELETE', `/patient-portal/family/${id}`),

  // Notifications
  notifications: () => pget<{ items: PatientNotificationItem[]; unread: number }>('/patient-portal/notifications'),
  markNotificationRead: (id: string) => ppost(`/patient-portal/notifications/${id}/read`),
  markAllNotificationsRead: () => ppost('/patient-portal/notifications/read-all'),

  // Settings
  settings: () => pget<PortalSettings>('/patient-portal/settings'),
  updateProfile: (body: { displayName?: string; mobile?: string }) =>
    pmutate<{ displayName: string | null; mobile: string | null }>('PATCH', '/patient-portal/settings/profile', { body }),
  updateNotificationPrefs: (body: NotificationPrefs) =>
    pmutate<NotificationPrefs>('PATCH', '/patient-portal/settings/notifications', { body }),

  // Refills (tenant-scoped)
  refills: (t: string) => pget<RefillRequest[]>('/patient-portal/refills', t),
  createRefill: (body: { tenantId: string; prescriptionId?: string; note?: string }) =>
    ppost<RefillRequest>('/patient-portal/refills', { body: body, tenantId: body.tenantId }),

  // Clinical record / lab-result detail (tenant-scoped)
  reportDetail: (t: string, id: string) => pget<ReportDetail>(`/patient-portal/reports/${id}`, t),
};

export const inrMoney = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN');
