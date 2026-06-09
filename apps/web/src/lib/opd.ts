import { apiGet, apiPost } from './api';

interface PatientRef {
  id: string;
  fullName: string;
  mrn: string;
  dob?: string | null;
  sex?: string | null;
  phone?: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string | null;
  departmentId: string | null;
  scheduledAt: string;
  status: string;
  reason: string | null;
  cancellationReason: string | null;
  patient?: PatientRef;
}

export interface Encounter {
  id: string;
  patientId: string;
  providerId: string | null;
  departmentId: string | null;
  type: string;
  status: string;
  chiefComplaint: string | null;
  tokenNumber: number | null;
  startedAt: string | null;
  endedAt: string | null;
  followUpDate: string | null;
  followUpNotes: string | null;
  createdAt: string;
  patient?: PatientRef;
}

export interface Vitals {
  id: string;
  systolicBp: number | null;
  diastolicBp: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  weightKg: number | null;
  heightCm: number | null;
  respiratoryRate: number | null;
  notes: string | null;
  recordedAt: string;
}
export interface Diagnosis {
  id: string;
  description: string;
  icdCode: string | null;
  type: string;
  notes: string | null;
  createdAt: string;
}
export interface ClinicalNote {
  id: string;
  noteType: string;
  content: string;
  createdAt: string;
}
export interface PrescriptionItem {
  id: string;
  drugName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  quantity: number;
}
export interface Prescription {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  finalizedAt: string | null;
  items: PrescriptionItem[];
  encounter?: { patient?: PatientRef };
}

export interface EncounterDetail extends Encounter {
  patient: PatientRef & { allergies: { id: string; substance: string; severity: string | null }[] };
  vitals: Vitals[];
  diagnoses: Diagnosis[];
  notes: ClinicalNote[];
  prescriptions: Prescription[];
}

export interface DoctorRef {
  id: string;
  fullName: string;
  speciality: string | null;
  departmentId: string | null;
}
export interface DepartmentRef {
  id: string;
  name: string;
}

export const opdApi = {
  doctors: (t: string) => apiGet<DoctorRef[]>('/opd/doctors', t),
  departments: (t: string) => apiGet<DepartmentRef[]>('/opd/departments', t),

  // appointments
  listAppointments: (t: string, params: Record<string, string> = {}) =>
    apiGet<Appointment[]>(`/appointments${qs(params)}`, t),
  bookAppointment: (
    t: string,
    body: { patientId: string; providerId?: string; departmentId?: string; scheduledAt: string; reason?: string },
  ) => apiPost<Appointment>('/appointments', body, t),
  rescheduleAppointment: (t: string, id: string, scheduledAt: string, reason: string) =>
    apiPost<Appointment>(`/appointments/${id}/reschedule`, { scheduledAt, reason }, t),
  cancelAppointment: (t: string, id: string, reason: string) =>
    apiPost<Appointment>(`/appointments/${id}/cancel`, { reason }, t),

  // encounters
  listEncounters: (t: string, params: Record<string, string> = {}) =>
    apiGet<Encounter[]>(`/encounters${qs(params)}`, t),
  queue: (t: string, params: Record<string, string> = {}) => apiGet<Encounter[]>(`/encounters/queue${qs(params)}`, t),
  createEncounter: (
    t: string,
    body: {
      patientId: string;
      providerId?: string;
      departmentId?: string;
      appointmentId?: string;
      type?: string;
      chiefComplaint?: string;
    },
  ) => apiPost<Encounter>('/encounters', body, t),
  detail: (t: string, id: string) => apiGet<EncounterDetail>(`/encounters/${id}/detail`, t),
  checkin: (t: string, id: string) => apiPost<Encounter>(`/encounters/${id}/checkin`, {}, t),
  start: (t: string, id: string) => apiPost<Encounter>(`/encounters/${id}/start`, {}, t),
  complete: (t: string, id: string, body: { followUpDate?: string; followUpNotes?: string }) =>
    apiPost<Encounter>(`/encounters/${id}/complete`, body, t),
  cancelEncounter: (t: string, id: string, reason: string) =>
    apiPost<Encounter>(`/encounters/${id}/cancel`, { reason }, t),

  addVitals: (t: string, id: string, body: Partial<Vitals>) => apiPost<Vitals>(`/encounters/${id}/vitals`, body, t),
  addDiagnosis: (
    t: string,
    id: string,
    body: { description: string; icdCode?: string; type?: string; notes?: string },
  ) => apiPost<Diagnosis>(`/encounters/${id}/diagnoses`, body, t),
  addNote: (t: string, id: string, body: { content: string; noteType?: string }) =>
    apiPost<ClinicalNote>(`/encounters/${id}/notes`, body, t),

  listPrescriptions: (t: string, encounterId: string) =>
    apiGet<Prescription[]>(`/encounters/${encounterId}/prescriptions`, t),
  createPrescription: (t: string, encounterId: string, body: { notes?: string; items: Partial<PrescriptionItem>[] }) =>
    apiPost<Prescription>(`/encounters/${encounterId}/prescriptions`, body, t),
  getPrescription: (t: string, id: string) => apiGet<Prescription>(`/prescriptions/${id}`, t),
  finalizePrescription: (t: string, id: string) => apiPost<Prescription>(`/prescriptions/${id}/finalize`, {}, t),
};

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

export const ENCOUNTER_STATUSES = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
