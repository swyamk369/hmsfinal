import { apiGet, apiPost, apiPatch } from './api';

export const WARD_TYPES = ['GENERAL', 'PRIVATE', 'ICU', 'HDU', 'MATERNITY', 'PEDIATRIC'] as const;
export const BED_STATUSES = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'] as const;
export const MED_ADMIN_STATUSES = ['ADMINISTERED', 'REFUSED', 'MISSED', 'HELD'] as const;

interface PatientRef {
  id: string;
  fullName: string;
  mrn: string;
  dob?: string | null;
  sex?: string | null;
  phone?: string | null;
}

export interface Ward {
  id: string;
  name: string;
  type: string;
  active: boolean;
  _count?: { beds: number };
}

export interface Bed {
  id: string;
  wardId: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
  ward?: { name: string };
  admission?: AdmissionLite | null;
}

export interface AdmissionLite {
  id: string;
  patientId: string;
  bedId: string;
  providerId: string | null;
  status: 'ADMITTED' | 'DISCHARGED' | 'TRANSFERRED' | 'CANCELLED';
  admittedAt: string;
  dischargedAt: string | null;
  expectedDischargeAt: string | null;
  patient?: PatientRef;
  bed?: { bedNumber: string; ward?: { name: string } };
}

export interface Occupancy {
  wards: (Ward & { beds: Bed[] })[];
  counts: { occupied: number; available: number; maintenance: number; reserved: number; dischargesToday: number };
}

export interface Round {
  id: string;
  providerId: string | null;
  notes: string;
  createdAt: string;
}
export interface Charge {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  billItemId: string | null;
  createdAt: string;
}
export interface Transfer {
  id: string;
  fromBedId: string;
  toBedId: string;
  reason: string | null;
  transferredAt: string;
}
export interface Vitals {
  id: string;
  systolicBp: number | null;
  diastolicBp: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  respiratoryRate: number | null;
  notes: string | null;
  recordedAt: string;
}
export interface NursingNote {
  id: string;
  note: string;
  createdAt: string;
}
export interface MedAdmin {
  id: string;
  prescriptionItemId: string | null;
  status: string;
  notes: string | null;
  administeredAt: string;
}

export interface AdmissionDetail extends AdmissionLite {
  encounterId: string | null;
  dischargeReason: string | null;
  dischargeNotes: string | null;
  providerName: string | null;
  patient: PatientRef & { allergies: { id: string; substance: string; severity: string | null }[] };
  bed: { id: string; bedNumber: string; status: string; ward: { id: string; name: string; type: string } };
  rounds: Round[];
  charges: Charge[];
  transfers: Transfer[];
  nursingNotes: NursingNote[];
  medications: MedAdmin[];
  vitals: Vitals[];
  labOrders: { id: string; status: string; createdAt: string }[];
  bill: { id: string; billNumber: string; netAmount: number; status: string; items: any[]; payments: any[] } | null;
  dischargeSummary: { id: string; summary: string; instructions: string | null; followUpDate: string | null; finalizedAt: string | null } | null;
}

export interface DischargeSummaryView {
  admission: AdmissionDetail;
  diagnoses: { id: string; description: string; icdCode: string | null; type: string }[];
  hospital: { name: string; address: string | null; phone: string | null; currency: string };
}

export const ipdApi = {
  occupancy: (t: string) => apiGet<Occupancy>('/ipd/occupancy', t),
  listWards: (t: string) => apiGet<Ward[]>('/ipd/wards', t),
  createWard: (t: string, body: { name: string; type?: string }) => apiPost<Ward>('/ipd/wards', body, t),
  updateWard: (t: string, id: string, body: Record<string, unknown>) => apiPatch<Ward>(`/ipd/wards/${id}`, body, t),
  listBeds: (t: string, wardId?: string) => apiGet<Bed[]>(`/ipd/beds${wardId ? `?wardId=${wardId}` : ''}`, t),
  createBed: (t: string, body: { wardId: string; bedNumber: string; status?: string }) => apiPost<Bed>('/ipd/beds', body, t),
  updateBed: (t: string, id: string, body: Record<string, unknown>) => apiPatch<Bed>(`/ipd/beds/${id}`, body, t),
  listAdmissions: (t: string, params: Record<string, string> = {}) => apiGet<AdmissionLite[]>(`/ipd/admissions${qs(params)}`, t),
  admit: (t: string, body: { patientId: string; bedId: string; providerId?: string; expectedDischargeAt?: string; reason?: string }) =>
    apiPost<AdmissionDetail>('/ipd/admissions', body, t),
  getAdmission: (t: string, id: string) => apiGet<AdmissionDetail>(`/ipd/admissions/${id}`, t),
  summary: (t: string, id: string) => apiGet<DischargeSummaryView>(`/ipd/admissions/${id}/summary`, t),
  transfer: (t: string, id: string, toBedId: string, reason: string) => apiPost<AdmissionDetail>(`/ipd/admissions/${id}/transfer`, { toBedId, reason }, t),
  addRound: (t: string, id: string, notes: string) => apiPost<Round>(`/ipd/admissions/${id}/rounds`, { notes }, t),
  addCharge: (t: string, id: string, body: { description: string; quantity?: number; unitPrice: number; notes?: string }) =>
    apiPost<Charge>(`/ipd/admissions/${id}/charges`, body, t),
  discharge: (t: string, id: string, body: { reason: string; summary: string; instructions?: string; followUpDate?: string }) =>
    apiPost<AdmissionDetail>(`/ipd/admissions/${id}/discharge`, body, t),
};

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}
