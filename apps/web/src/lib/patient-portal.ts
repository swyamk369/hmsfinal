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
};

export const inrMoney = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN');
