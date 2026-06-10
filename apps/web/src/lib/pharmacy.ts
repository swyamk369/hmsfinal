import { apiGet, apiPost } from './api';

interface PatientRef {
  id: string;
  fullName: string;
  mrn: string;
  dob?: string | null;
  sex?: string | null;
  phone?: string | null;
}

export interface RxItem {
  id: string;
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  quantity: number;
  inventoryItemId: string | null;
}

export interface PharmacyPrescription {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  finalizedAt: string | null;
  items: RxItem[];
  encounter?: { patient?: PatientRef & { allergies?: { id: string; substance: string; severity: string | null }[] } };
}

export interface AvailabilityMatch {
  inventoryItemId: string;
  name: string;
  unit: string;
  available: number;
  batches: { id: string; batchNumber: string; expiryDate: string | null; quantity: number; salePrice: number }[];
}
export interface AvailabilityLine {
  prescriptionItemId: string;
  drugName: string;
  requestedQty: number;
  matches: AvailabilityMatch[];
  status: 'FOUND' | 'INSUFFICIENT' | 'MISSING';
}
export interface Availability {
  prescriptionId: string;
  status: string;
  lines: AvailabilityLine[];
}

export interface DispenseItemRow {
  id: string;
  prescriptionItemId: string | null;
  inventoryItemId: string;
  batchId: string;
  quantity: number;
  unitPrice: number;
}
export interface DispenseRecord {
  id: string;
  prescriptionId: string;
  patientId: string;
  status: string;
  billId: string | null;
  createdAt: string;
  items: DispenseItemRow[];
  patient?: PatientRef | null;
}

export interface PharmacyStats {
  pendingCount: number;
  dispensedToday: number;
  lowStockCount: number;
  nearExpiry: number;
}

export const pharmacyApi = {
  listPrescriptions: (t: string, params: Record<string, string> = {}) =>
    apiGet<PharmacyPrescription[]>(`/pharmacy/prescriptions${qs(params)}`, t),
  getPrescription: (t: string, id: string) => apiGet<PharmacyPrescription>(`/pharmacy/prescriptions/${id}`, t),
  availability: (t: string, id: string) => apiGet<Availability>(`/pharmacy/prescriptions/${id}/availability`, t),
  dispense: (
    t: string,
    id: string,
    body: { items: { prescriptionItemId?: string; inventoryItemId: string; quantity: number }[] },
  ) => apiPost<DispenseRecord>(`/pharmacy/prescriptions/${id}/dispense`, body, t),
  returns: (
    t: string,
    body: { dispenseRecordId: string; reason: string; items?: { dispenseItemId: string; quantity: number }[] },
  ) => apiPost<DispenseRecord>('/pharmacy/returns', body, t),
  listDispenses: (t: string) => apiGet<DispenseRecord[]>('/pharmacy/dispenses', t),
  getDispense: (t: string, id: string) => apiGet<DispenseRecord>(`/pharmacy/dispenses/${id}`, t),
  stats: (t: string) => apiGet<PharmacyStats>('/pharmacy/stats', t),
};

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}
