import { apiGet, apiPost, apiPatch, apiDelete } from './api';

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  dob: string | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  deletedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  allergies?: Allergy[];
  histories?: MedicalHistory[];
  consents?: Consent[];
}

export interface Allergy {
  id: string;
  substance: string;
  severity: string | null;
  notes: string | null;
}
export interface MedicalHistory {
  id: string;
  type: string;
  description: string;
  recordedAt: string;
}
export interface Consent {
  id: string;
  purpose: string;
  grantedAt: string;
  revokedAt: string | null;
}
export interface PatientDocument {
  id: string;
  patientId: string;
  title: string;
  category: 'CLINICAL' | 'BILLING' | 'INSURANCE' | 'CONSENT' | 'LAB' | 'DISCHARGE' | 'GENERATED_REPORT' | 'OTHER';
  source: 'UPLOADED' | 'EXTERNAL' | 'GENERATED';
  mimeType: string | null;
  fileName: string | null;
  documentUrl: string;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface PatientTimeline {
  patient: Patient;
  encounters: any[];
  appointments: any[];
  bills: any[];
  prescriptions: any[];
  labOrders: any[];
  allergies: Allergy[];
  histories: MedicalHistory[];
  consents: Consent[];
  documents: PatientDocument[];
}

export interface PatientJourney {
  patientId: string;
  patientName: string;
  mrn: string;
  current: {
    status: string;
    module: string;
    location: string | null;
    href: string;
    label: string;
  };
  nextRecommendedAction: {
    label: string;
    href: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  };
  blockers: Array<{ type: string; message: string; href: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' }>;
  activeAppointment: any | null;
  activeEncounter: any | null;
  activeAdmission: any | null;
  pendingLabOrders: Array<{ id: string; status: string; createdAt: string; tests: string[] }>;
  pendingPrescriptions: Array<{ id: string; status: string; finalizedAt: string | null; itemCount: number }>;
  pendingCharges: Array<{ id: string; sourceModule: string; name: string; total: number; createdAt: string }>;
  openBills: Array<{ id: string; billNumber: string; status: string; netAmount: number; outstanding: number }>;
  activeClaim: any | null;
  documentCount: number;
}

export interface RegisterPatientInput {
  fullName: string;
  dob?: string;
  sex?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  consent?: boolean;
}

export const patientsApi = {
  list: (t: string, q?: string) => apiGet<Patient[]>(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`, t),
  get: (t: string, id: string) => apiGet<Patient>(`/patients/${id}`, t),
  register: (t: string, body: RegisterPatientInput) => apiPost<Patient>('/patients', body, t),
  update: (t: string, id: string, body: Partial<RegisterPatientInput>) => apiPatch<Patient>(`/patients/${id}`, body, t),
  archive: (t: string, id: string, reason: string) => apiDelete<Patient>(`/patients/${id}`, { reason }, t),
  timeline: (t: string, id: string) => apiGet<PatientTimeline>(`/patients/${id}/timeline`, t),
  journey: (t: string, id: string) => apiGet<PatientJourney>(`/patients/${id}/journey`, t),
  addConsent: (t: string, id: string, purpose: string) => apiPost<Consent>(`/patients/${id}/consents`, { purpose }, t),
  addAllergy: (t: string, id: string, body: { substance: string; severity?: string; notes?: string }) =>
    apiPost<Allergy>(`/patients/${id}/allergies`, body, t),
  addHistory: (t: string, id: string, body: { type: string; description: string }) =>
    apiPost<MedicalHistory>(`/patients/${id}/history`, body, t),
  listDocuments: (t: string, id: string) => apiGet<PatientDocument[]>(`/patients/${id}/documents`, t),
  attachDocument: (
    t: string,
    id: string,
    body: {
      title: string;
      category?: PatientDocument['category'];
      mimeType?: string;
      fileName?: string;
      documentUrl: string;
      notes?: string;
    },
  ) => apiPost<PatientDocument>(`/patients/${id}/documents`, body, t),
  generateSummaryDocument: (t: string, id: string, body?: { title?: string; notes?: string }) =>
    apiPost<PatientDocument>(`/patients/${id}/documents/summary`, body ?? {}, t),
};
