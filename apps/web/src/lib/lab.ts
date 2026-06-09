import { apiGet, apiPost, apiPatch } from './api';

export const LAB_STATUSES = ['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;
export const ABNORMAL_FLAGS = ['NORMAL', 'HIGH', 'LOW', 'CRITICAL'] as const;
export type AbnormalFlag = (typeof ABNORMAL_FLAGS)[number];

export interface PatientRef {
  id: string;
  fullName: string;
  mrn: string;
  dob?: string | null;
  sex?: string | null;
  phone?: string | null;
}

export interface LabTestCatalog {
  id: string;
  code: string;
  name: string;
  specimenType: string | null;
  price: number;
  active: boolean;
}

export interface LabSample {
  id: string;
  barcode: string | null;
  collectedById: string | null;
  collectedAt: string | null;
  status: string;
}

export interface LabResult {
  id: string;
  labOrderItemId: string;
  testName: string;
  value: string | null;
  unit: string | null;
  referenceRange: string | null;
  abnormalFlag: AbnormalFlag;
  notes: string | null;
  enteredById: string | null;
  verifiedById: string | null;
  isVerified: boolean;
  recordedAt: string;
  verifiedAt: string | null;
}

export interface LabOrderItem {
  id: string;
  testId: string;
  testName: string;
  status: string;
  samples: LabSample[];
  results: LabResult[];
}

export interface LabOrder {
  id: string;
  patientId: string;
  encounterId: string | null;
  providerId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  patient?: PatientRef;
  items: LabOrderItem[];
  billing?: { billed: boolean; reason?: string; items?: number; amount?: number };
}

export interface LabStats {
  ordered: number;
  sampleCollected: number;
  processing: number;
  pendingVerification: number;
  completedToday: number;
}

export interface LabReport {
  order: LabOrder;
  hospital: { name: string; address: string | null; phone: string | null; email: string | null; currency: string };
}

export interface ResultEntry {
  labOrderItemId: string;
  testName?: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  abnormalFlag?: AbnormalFlag;
  notes?: string;
}

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

export const labApi = {
  catalog: (t: string) => apiGet<LabTestCatalog[]>('/lab/catalog', t),
  createCatalog: (t: string, body: { code: string; name: string; specimenType?: string; price?: number }) =>
    apiPost<LabTestCatalog>('/lab/catalog', body, t),
  updateCatalog: (t: string, id: string, body: Partial<LabTestCatalog>) =>
    apiPatch<LabTestCatalog>(`/lab/catalog/${id}`, body, t),

  stats: (t: string) => apiGet<LabStats>('/lab/stats', t),
  orders: (t: string, params: Record<string, string> = {}) => apiGet<LabOrder[]>(`/lab/orders${qs(params)}`, t),
  order: (t: string, id: string) => apiGet<LabOrder>(`/lab/orders/${id}`, t),
  create: (
    t: string,
    body: { patientId: string; encounterId?: string; notes?: string; tests: { testId: string; testName: string }[] },
  ) => apiPost<LabOrder>('/lab/orders', body, t),

  collectSample: (t: string, id: string, body: { labOrderItemId?: string; barcode?: string } = {}) =>
    apiPost<LabOrder>(`/lab/orders/${id}/sample`, body, t),
  setStatus: (t: string, id: string, status: string, reason?: string) =>
    apiPatch<LabOrder>(`/lab/orders/${id}/status`, { status, reason }, t),
  enterResults: (t: string, id: string, results: ResultEntry[]) =>
    apiPost<LabOrder>(`/lab/orders/${id}/results`, { results }, t),
  verifyResult: (t: string, resultId: string) =>
    apiPost<{ orderId: string | null }>(`/lab/results/${resultId}/verify`, {}, t),
  report: (t: string, id: string) => apiGet<LabReport>(`/lab/reports/${id}`, t),

  // Clinical integration (encounter scope)
  encounterOrders: (t: string, encounterId: string) =>
    apiGet<LabOrder[]>(`/encounters/${encounterId}/lab-orders`, t),
  orderFromEncounter: (
    t: string,
    encounterId: string,
    body: { notes?: string; tests: { testId: string; testName: string }[] },
  ) => apiPost<LabOrder>(`/encounters/${encounterId}/lab-orders`, body, t),
};

export const STATUS_TONE: Record<string, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  ORDERED: 'gray',
  SAMPLE_COLLECTED: 'blue',
  PROCESSING: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

export const FLAG_TONE: Record<AbnormalFlag, 'gray' | 'amber' | 'red'> = {
  NORMAL: 'gray',
  HIGH: 'amber',
  LOW: 'amber',
  CRITICAL: 'red',
};
