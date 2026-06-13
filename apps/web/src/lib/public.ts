// Public, no-auth API client for the patient-facing directory (Phase 22.3).
// Plain fetch — no tenant header. Booking creation OPTIONALLY attaches the
// signed-in patient's Firebase token so booking notifications reach them.

import { getFirebaseIdToken } from './firebase';
import { apiBaseUrl } from './api-url';

const API = apiBaseUrl();

function qs(params: Record<string, string | undefined>): string {
  const e = Object.entries(params).filter(([, v]) => v);
  return e.length ? `?${new URLSearchParams(Object.fromEntries(e as [string, string][])).toString()}` : '';
}

async function getPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Something went wrong. Please try again.');
  }
  return res.json();
}

async function postPublic<T>(path: string, body: unknown, withIdentity = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withIdentity) {
    // Best-effort: anonymous booking stays fully supported.
    const token = await getFirebaseIdToken().catch(() => null);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(
      (Array.isArray(b.message) ? b.message.join(', ') : b.message) || 'Booking failed. Please try again.',
    );
  }
  return res.json();
}

export interface SearchRow {
  id: string;
  type: 'HOSPITAL' | 'DOCTOR' | 'SERVICE';
  tenantId: string;
  doctorId: string | null;
  hospitalSlug: string | null;
  doctorSlug: string | null;
  hospitalName: string;
  doctorName: string | null;
  specialty: string | null;
  services: string[];
  location: string | null;
  city: string | null;
  state: string | null;
  consultationTypes: string[];
  languages: string[];
  isBookable: boolean;
  profileUrl: string;
  // Optional enrichment (populated by the search-index sync when available; the
  // UI renders these only when present — never fabricates them).
  photoUrl?: string | null;
  logoUrl?: string | null;
  fees?: number | null;
  nextAvailableSlot?: string | null;
}

export interface PublicHospital {
  tenantId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facilities: string[];
  specialties: string[];
  services: string[];
  consultationTypes: string[];
  insuranceAccepted?: string[];
  languages: string[];
  bookingEnabled: boolean;
}

export interface PublicDoctor {
  tenantId: string;
  doctorId: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  specialty: string | null;
  subSpecialties: string[];
  qualifications: string | null;
  registrationNumber?: string | null;
  bio: string | null;
  languages: string[];
  gender?: string | null;
  services: string[];
  consultationTypes: string[];
  fees: unknown;
  acceptsNewPatients: boolean;
  acceptsExistingPatients?: boolean;
  telehealthAvailable: boolean;
  bookingEnabled: boolean;
}

export interface PublicAppointmentType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  consultationType: string;
}

export interface BookingOptions {
  doctor: string;
  specialty: string | null;
  hospital: string;
  consultationTypes: string[];
  appointmentTypes: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
    currency: string;
    consultationType: string;
  }[];
}
export interface DaySlots {
  date: string;
  slots: { time: string; available: boolean }[];
}
export interface BookingResult {
  bookingId: string;
  bookingStatus: string;
  approvalStatus: string;
  requiresApproval: boolean;
  hospital: string;
  doctor: string;
  date: string;
  time: string;
  consultationType: string;
}

export const publicApi = {
  hospitals: (q?: string, city?: string) => getPublic<SearchRow[]>(`/public/hospitals${qs({ q, city })}`),
  hospital: (slug: string) =>
    getPublic<{ hospital: PublicHospital; doctors: PublicDoctor[]; appointmentTypes: PublicAppointmentType[] }>(
      `/public/hospitals/${slug}`,
    ),
  doctors: (q?: string, specialty?: string, city?: string) =>
    getPublic<SearchRow[]>(`/public/doctors${qs({ q, specialty, city })}`),
  doctor: (slug: string) =>
    getPublic<{ doctor: PublicDoctor; hospital: PublicHospital | null; appointmentTypes: PublicAppointmentType[] }>(
      `/public/doctors/${slug}`,
    ),
  search: (q?: string, type?: string) => getPublic<SearchRow[]>(`/public/search${qs({ q, type })}`),

  bookingOptions: (tenantId: string, doctorId: string) =>
    getPublic<BookingOptions>(`/public/booking/options${qs({ tenantId, doctorId })}`),
  bookingSlots: (tenantId: string, doctorId: string, from?: string, days = 14, appointmentTypeId?: string) =>
    getPublic<DaySlots[]>(
      `/public/booking/slots${qs({ tenantId, doctorId, from, days: String(days), appointmentTypeId })}`,
    ),
  createBooking: (body: Record<string, unknown>) => postPublic<BookingResult>('/public/booking/create', body, true),
};

export const inr = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN');
