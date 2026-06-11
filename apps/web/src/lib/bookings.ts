import { apiGet, apiPost } from './api';

export interface OnlineBookingRow {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  doctorId: string;
  doctorName: string | null;
  appointmentId: string | null;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: string;
  reasonForVisit: string | null;
  bookingStatus: string;
  approvalStatus: string;
  newOrExistingPatient: string;
  possibleDuplicatePatient: boolean;
  createdAt: string;
  patient: { id: string; fullName: string; mrn: string } | null;
}

export interface OnlineBookingDetail extends OnlineBookingRow {
  duplicates: { id: string; fullName: string; mrn: string; phone: string | null; email: string | null }[];
}

export const bookingsApi = {
  list: (t: string, status?: string) => apiGet<OnlineBookingRow[]>(`/hms/online-bookings${status ? `?status=${status}` : ''}`, t),
  get: (t: string, id: string) => apiGet<OnlineBookingDetail>(`/hms/online-bookings/${id}`, t),
  approve: (t: string, id: string) => apiPost(`/hms/online-bookings/${id}/approve`, {}, t),
  reject: (t: string, id: string, reason: string) => apiPost(`/hms/online-bookings/${id}/reject`, { reason }, t),
  reschedule: (t: string, id: string, date: string, time: string) => apiPost(`/hms/online-bookings/${id}/reschedule`, { date, time }, t),
  linkPatient: (t: string, id: string, patientId: string) => apiPost(`/hms/online-bookings/${id}/link-patient`, { patientId }, t),
};
