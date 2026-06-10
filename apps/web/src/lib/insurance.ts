import { apiGet, apiPatch, apiPost } from './api';
import type { Bill } from './billing';

export const CLAIM_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'SETTLED',
  'CANCELLED',
] as const;

export interface PatientRef {
  id: string;
  fullName: string;
  mrn: string;
  phone?: string | null;
}

export interface InsuranceProvider {
  id: string;
  name: string;
  contact: string | null;
  active: boolean;
  createdAt: string;
}

export interface CoverageDetails {
  memberId?: string;
  planName?: string;
  coverageType?: string;
  validFrom?: string;
  validTo?: string;
  coverageLimit?: number;
  patientSharePercent?: number;
  notes?: string;
}

export interface PatientInsurancePolicy {
  id: string;
  patientId: string;
  providerId: string;
  policyNumber: string;
  coverageDetails: string | null;
  coverage?: CoverageDetails;
  active: boolean;
  createdAt: string;
  patient?: PatientRef;
  provider?: InsuranceProvider;
  _count?: { claims: number };
}

export interface ClaimSettlement {
  id: string;
  claimId: string;
  paymentId: string | null;
  amount: number;
  settledById: string | null;
  settledAt: string;
  notes: string | null;
}

export interface InsuranceClaim {
  id: string;
  billId: string;
  patientPolicyId: string;
  providerId: string | null;
  claimAmount: number;
  approvedAmount: number | null;
  patientShare: number | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  settledAt: string | null;
  settlementNotes: string | null;
  notes: string | null;
  createdAt: string;
  bill?: Bill;
  patientPolicy?: PatientInsurancePolicy;
  settlements: ClaimSettlement[];
}

export interface InsuranceReceivables {
  stats: {
    openClaims: number;
    submittedAmount: number;
    approvedOutstanding: number;
    settledToday: number;
    patientShare: number;
  };
  claims: InsuranceClaim[];
}

export type CreatePolicyInput = {
  patientId: string;
  providerId: string;
  policyNumber: string;
  memberId?: string;
  planName?: string;
  coverageType?: string;
  validFrom?: string;
  validTo?: string;
  coverageLimit?: number;
  patientSharePercent?: number;
  notes?: string;
};

export type CreateClaimInput = {
  billId: string;
  patientPolicyId: string;
  claimAmount?: number;
  patientShare?: number;
  notes?: string;
  submit?: boolean;
};

export const insuranceApi = {
  providers: (t: string) => apiGet<InsuranceProvider[]>('/insurance/providers', t),
  policies: (t: string, params: Record<string, string> = {}) =>
    apiGet<PatientInsurancePolicy[]>(`/insurance/policies${qs(params)}`, t),
  createPolicy: (t: string, body: CreatePolicyInput) =>
    apiPost<PatientInsurancePolicy>('/insurance/policies', body, t),
  updatePolicy: (t: string, id: string, body: Partial<CreatePolicyInput> & { active?: boolean }) =>
    apiPatch<PatientInsurancePolicy>(`/insurance/policies/${id}`, body, t),
  bills: (t: string, params: Record<string, string> = {}) => apiGet<Bill[]>(`/insurance/bills${qs(params)}`, t),
  claims: (t: string, params: Record<string, string> = {}) =>
    apiGet<InsuranceClaim[]>(`/insurance/claims${qs(params)}`, t),
  createClaim: (t: string, body: CreateClaimInput) => apiPost<InsuranceClaim>('/insurance/claims', body, t),
  getClaim: (t: string, id: string) => apiGet<InsuranceClaim>(`/insurance/claims/${id}`, t),
  updateClaim: (t: string, id: string, body: { notes?: string }) =>
    apiPatch<InsuranceClaim>(`/insurance/claims/${id}`, body, t),
  submitClaim: (t: string, id: string, notes?: string) =>
    apiPost<InsuranceClaim>(`/insurance/claims/${id}/submit`, { notes }, t),
  reviewClaim: (t: string, id: string, notes?: string) =>
    apiPost<InsuranceClaim>(`/insurance/claims/${id}/review`, { notes }, t),
  approveClaim: (t: string, id: string, body: { approvedAmount?: number; patientShare?: number; notes?: string }) =>
    apiPost<InsuranceClaim>(`/insurance/claims/${id}/approve`, body, t),
  rejectClaim: (t: string, id: string, reason: string) =>
    apiPost<InsuranceClaim>(`/insurance/claims/${id}/reject`, { reason }, t),
  settleClaim: (t: string, id: string, body: { amount?: number; transactionId?: string; notes?: string }) =>
    apiPost<InsuranceClaim>(`/insurance/claims/${id}/settle`, body, t),
  cancelClaim: (t: string, id: string, reason: string) =>
    apiPost<InsuranceClaim>(`/insurance/claims/${id}/cancel`, { reason }, t),
  receivables: (t: string) => apiGet<InsuranceReceivables>('/insurance/receivables', t),
};

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

export function claimSettled(claim: InsuranceClaim): number {
  return claim.settlements?.reduce((sum, s) => sum + s.amount, 0) ?? 0;
}

export function claimApproved(claim: InsuranceClaim): number {
  return claim.approvedAmount ?? claim.claimAmount;
}
