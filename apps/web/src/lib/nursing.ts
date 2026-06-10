import { apiGet, apiPost, apiPatch } from './api';
import type { AdmissionDetail, AdmissionLite, MedAdmin, Vitals, NursingNote } from './ipd';

export interface NursingDashboard {
  admissions: (AdmissionLite & { allergyCount: number })[];
  counts: { admitted: number; vitalsToday?: number; vitalsDue?: number; medsToday: number; notesToday: number; alerts: number };
}

export const nursingApi = {
  dashboard: (t: string) => apiGet<NursingDashboard>('/nursing/dashboard', t),
  getAdmission: (t: string, id: string) => apiGet<AdmissionDetail>(`/nursing/admissions/${id}`, t),
  addVitals: (t: string, id: string, body: Partial<Vitals>) => apiPost<Vitals>(`/nursing/admissions/${id}/vitals`, body, t),
  addNote: (t: string, id: string, note: string) => apiPost<NursingNote>(`/nursing/admissions/${id}/notes`, { note }, t),
  listMedications: (t: string, id: string) => apiGet<MedAdmin[]>(`/nursing/admissions/${id}/medications`, t),
  addMedication: (t: string, id: string, body: { prescriptionItemId?: string; status?: string; notes?: string }) =>
    apiPost<MedAdmin>(`/nursing/admissions/${id}/medications`, body, t),
  updateMedication: (t: string, medId: string, body: { status?: string; notes?: string }) =>
    apiPatch<MedAdmin>(`/nursing/medications/${medId}`, body, t),
};
