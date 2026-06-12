import { apiGet, apiPost, apiPatch, apiPut } from './api';

export interface PortalSettings {
  enabled: boolean;
  onlineBookingEnabled: boolean;
  bookingApprovalMode: 'AUTOMATIC' | 'MANUAL' | 'HYBRID';
  allowNewPatientBookings: boolean;
  allowExistingPatientBookings: boolean;
  minimumBookingNoticeHours: number;
  maximumBookingAdvanceDays: number;
  timezone: string;
  clinicDisplayName: string | null;
  publicContactNumber: string | null;
  publicEmail: string | null;
  bookingTerms: string | null;
  cancellationPolicy: string | null;
}

export interface AvailabilityRule {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
}

export interface AccessRequest {
  id: string;
  patientId: string;
  email: string | null;
  hospitalDisplayName: string | null;
  accessStatus: string;
  verificationStatus: string;
  createdAt: string;
  patient: { id: string; fullName: string; mrn: string; phone: string | null } | null;
}

export interface HospitalProfile {
  hospitalDisplayName: string;
  hospitalSlug: string;
  isPublic: boolean;
  bookingEnabled: boolean;
  profileStatus: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
  description: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  specialties: string[];
  services: string[];
  facilities: string[];
}

export interface AppointmentType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  consultationType: 'IN_PERSON' | 'TELEHEALTH' | 'BOTH';
  requiresApproval: boolean;
  isPublic: boolean;
  isActive: boolean;
}

export interface DoctorProfileRow {
  id: string;
  doctorId: string;
  displayName: string;
  specialty: string | null;
  isPublic: boolean;
  bookingEnabled: boolean;
  profileStatus: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
}

const asList = (v: string) =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
export const listToText = (v?: string[]) => (v ?? []).join(', ');
export { asList as textToList };

export const publicAdminApi = {
  getSettings: (t: string) => apiGet<PortalSettings>('/hms/patient-portal/settings', t),
  saveSettings: (t: string, body: Partial<PortalSettings>) =>
    apiPut<PortalSettings>('/hms/patient-portal/settings', body, t),

  getProfile: (t: string) => apiGet<HospitalProfile | null>('/hms/public-profile', t),
  saveProfile: (t: string, body: Record<string, unknown>) => apiPut<HospitalProfile>('/hms/public-profile', body, t),
  publishProfile: (t: string) => apiPost<HospitalProfile>('/hms/public-profile/publish', {}, t),
  hideProfile: (t: string, reason: string) => apiPost<HospitalProfile>('/hms/public-profile/hide', { reason }, t),

  listTypes: (t: string) => apiGet<AppointmentType[]>('/hms/appointment-types', t),
  createType: (t: string, body: Record<string, unknown>) => apiPost<AppointmentType>('/hms/appointment-types', body, t),
  updateType: (t: string, id: string, body: Record<string, unknown>) =>
    apiPatch<AppointmentType>(`/hms/appointment-types/${id}`, body, t),

  listDoctorProfiles: (t: string) => apiGet<DoctorProfileRow[]>('/hms/public-doctor-profiles', t),
  createDoctorProfile: (t: string, body: Record<string, unknown>) =>
    apiPost<DoctorProfileRow>('/hms/public-doctor-profiles', body, t),
  publishDoctorProfile: (t: string, id: string) =>
    apiPost<DoctorProfileRow>(`/hms/public-doctor-profiles/${id}/publish`, {}, t),
  hideDoctorProfile: (t: string, id: string, reason: string) =>
    apiPost<DoctorProfileRow>(`/hms/public-doctor-profiles/${id}/hide`, { reason }, t),

  listAvailability: (t: string, doctorId: string) =>
    apiGet<AvailabilityRule[]>(`/hms/availability-rules?doctorId=${doctorId}`, t),
  createAvailabilityRule: (t: string, body: Record<string, unknown>) =>
    apiPost<AvailabilityRule>('/hms/availability-rules', body, t),
  updateAvailabilityRule: (t: string, id: string, body: Record<string, unknown>) =>
    apiPatch<AvailabilityRule>(`/hms/availability-rules/${id}`, body, t),

  listAccessRequests: (t: string) => apiGet<AccessRequest[]>('/hms/portal-access/requests', t),
  approveAccessRequest: (t: string, id: string) => apiPost(`/hms/portal-access/${id}/approve`, {}, t),
  rejectAccess: (t: string, id: string, reason: string) => apiPost(`/hms/portal-access/${id}/revoke`, { reason }, t),
};
