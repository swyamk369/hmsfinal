import { apiDelete, apiGet, apiPost, apiPut } from './api';
import type { Bill } from './billing';

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries as [string, string][])).toString()}` : '';
}

export type ChargeStatus = 'PENDING' | 'BILLED' | 'CANCELLED' | 'REFUNDED';
export type ChargeSource = 'OPD' | 'LAB' | 'PHARMACY' | 'IPD' | 'MANUAL' | 'INSURANCE';

export interface FinancePatient {
  id: string;
  fullName: string;
  mrn: string;
  phone?: string | null;
}

export interface LeakageRow {
  sourceId: string;
  patientId: string;
  label: string;
  occurredAt: string;
  href: string;
  estimated: number | null;
  admissionId?: string;
  patient: FinancePatient | null;
}

export interface LeakageCategory {
  key: string;
  label: string;
  actionable: boolean;
  count: number;
  rows: LeakageRow[];
}

export interface LeakageReport {
  generatedAt: string;
  totalCount: number;
  estimatedRecoverable: number;
  categories: LeakageCategory[];
}

export interface BillableCharge {
  id: string;
  patientId: string;
  encounterId: string | null;
  admissionId: string | null;
  billId: string | null;
  sourceModule: ChargeSource;
  sourceType: string;
  sourceId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: ChargeStatus;
  cancellationReason: string | null;
  createdAt: string;
  patient?: FinancePatient | null;
}

export interface FinanceDashboard {
  generatedAt: string;
  collectionToday: number;
  refundsToday: number;
  netCollectionToday: number;
  outstandingPatientDues: number;
  insuranceReceivables: number;
  pendingCharges: number;
  unpaidBills: number;
  partialBills: number;
  cancelledBillsToday: number;
  pendingApprovals: number;
  dayCloseStatus: string;
  paymentMethodSplit: Record<string, number>;
  moduleRevenue: Record<string, number>;
  blockers: { type: string; label: string; href: string }[];
  pendingChargeRows: BillableCharge[];
}

export interface PatientAccount {
  patient: any;
  charges: BillableCharge[];
  pendingCharges: BillableCharge[];
  bills: Bill[];
  claims: any[];
  documents: any[];
  totals: { pendingCharges: number; outstanding: number; paid: number; refunded: number };
}

export interface DayCloseSummary {
  businessDate: string;
  status: string;
  grossCollection: number;
  refundTotal: number;
  cancellationTotal: number;
  netCollection: number;
  cashTotal: number;
  cardTotal: number;
  upiTotal: number;
  bankTotal: number;
  insuranceTotal: number;
  otherTotal: number;
  payments: any[];
  refunds: any[];
  cancelledBills: Bill[];
  closes: any[];
}

export interface FinancePaymentRow {
  id: string;
  amount: number;
  method: string;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
  bill?: Bill & { patient?: FinancePatient | null };
}

export interface FinanceRefundRow {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  bill?: Bill & { patient?: FinancePatient | null };
}

export interface FinanceApproval {
  id: string;
  type: string;
  status: string;
  amount: number | null;
  entity: string;
  entityId: string | null;
  reason: string;
  notes: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
}

export interface AdvanceDeposit {
  id: string;
  patientId: string;
  admissionId: string | null;
  amount: number;
  paymentMethod: string;
  transactionId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostEstimateItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

export interface CostEstimate {
  id: string;
  patientId: string;
  status: string;
  validUntil: string | null;
  notes: string | null;
  totalAmount: number;
  totalTax: number;
  netAmount: number;
  createdAt: string;
  updatedAt: string;
  patient?: FinancePatient | null;
  items?: CostEstimateItem[];
}

export interface PriceList {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

export interface ServicePackage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  fixedPrice: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

export const financeApi = {
  dashboard: (t: string) => apiGet<FinanceDashboard>('/finance/dashboard', t),
  patientAccount: (t: string, patientId: string) => apiGet<PatientAccount>(`/finance/patient-accounts/${patientId}`, t),
  pendingCharges: (t: string, params: Record<string, string> = {}) =>
    apiGet<BillableCharge[]>(`/finance/pending-charges${qs(params)}`, t),
  createCharge: (
    t: string,
    body: {
      patientId: string;
      encounterId?: string;
      admissionId?: string;
      catalogId?: string;
      sourceModule: ChargeSource;
      sourceType: string;
      sourceId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
    },
  ) => apiPost<BillableCharge>('/finance/pending-charges', body, t),
  cancelCharge: (t: string, id: string, reason: string) =>
    apiPost<BillableCharge>(`/finance/pending-charges/${id}/cancel`, { reason }, t),
  billFromCharges: (t: string, body: { chargeIds: string[]; discount?: number; notes?: string }) =>
    apiPost<Bill>('/finance/bills/from-charges', body, t),
  bills: (t: string, params: Record<string, string> = {}) => apiGet<Bill[]>(`/finance/bills${qs(params)}`, t),
  bill: (t: string, id: string) => apiGet<Bill>(`/finance/bills/${id}`, t),
  pay: (t: string, id: string, body: { amount: number; method: string; transactionId?: string; notes?: string }) =>
    apiPost<Bill>(`/finance/bills/${id}/payments`, body, t),
  refund: (t: string, id: string, amount: number, reason: string) =>
    apiPost<Bill>(`/finance/bills/${id}/refunds`, { amount, reason }, t),
  cancelBill: (t: string, id: string, reason: string) => apiPost<Bill>(`/finance/bills/${id}/cancel`, { reason }, t),
  payments: (t: string, params: Record<string, string> = {}) =>
    apiGet<FinancePaymentRow[]>(`/finance/payments${qs(params)}`, t),
  refunds: (t: string, params: Record<string, string> = {}) =>
    apiGet<FinanceRefundRow[]>(`/finance/refunds${qs(params)}`, t),
  insuranceReceivables: (t: string) => apiGet<any[]>('/finance/insurance-receivables', t),
  dayClose: (t: string, params: Record<string, string> = {}) =>
    apiGet<DayCloseSummary>(`/finance/day-close${qs(params)}`, t),
  closeDay: (t: string, body: { businessDate?: string; cashierId?: string; notes?: string }) =>
    apiPost<any>('/finance/day-close', body, t),
  approvals: (t: string, status?: string) => apiGet<FinanceApproval[]>(`/finance/approvals${qs({ status })}`, t),
  requestApproval: (
    t: string,
    body: { type: string; entity: string; entityId?: string; amount?: number; reason: string; notes?: string },
  ) => apiPost<FinanceApproval>('/finance/approvals', body, t),
  approve: (t: string, id: string, reason: string) =>
    apiPost<FinanceApproval>(`/finance/approvals/${id}/approve`, { reason }, t),
  reject: (t: string, id: string, reason: string) =>
    apiPost<FinanceApproval>(`/finance/approvals/${id}/reject`, { reason }, t),
  reportSummary: (t: string) => apiGet<any>('/finance/reports/summary', t),
  leakage: (t: string) => apiGet<LeakageReport>('/finance/leakage', t),
  advanceDeposits: (t: string, patientId: string) =>
    apiGet<AdvanceDeposit[]>(`/finance/advance-deposits${qs({ patientId })}`, t),
  collectAdvanceDeposit: (
    t: string,
    body: {
      patientId: string;
      admissionId?: string;
      amount: number;
      paymentMethod: string;
      transactionId?: string;
      notes?: string;
    },
  ) => apiPost<AdvanceDeposit>('/finance/advance-deposits', body, t),
  consumeAdvanceDeposit: (t: string, id: string, amount: number) =>
    apiPost<AdvanceDeposit>(`/finance/advance-deposits/${id}/consume`, { amount }, t),
  refundAdvanceDeposit: (t: string, id: string, remarks: string) =>
    apiPost<AdvanceDeposit>(`/finance/advance-deposits/${id}/refund`, { remarks }, t),
  costEstimates: (t: string, patientId?: string) => apiGet<CostEstimate[]>(`/finance/estimates${qs({ patientId })}`, t),
  costEstimate: (t: string, id: string) => apiGet<CostEstimate>(`/finance/estimates/${id}`, t),
  createCostEstimate: (
    t: string,
    body: {
      patientId: string;
      notes?: string;
      validUntil?: string;
      items: Array<{ name: string; quantity: number; unitPrice: number; taxRate?: number }>;
    },
  ) => apiPost<CostEstimate>('/finance/estimates', body, t),
  updateCostEstimateStatus: (t: string, id: string, status: string) =>
    apiPut<CostEstimate>(`/finance/estimates/${id}/status`, { status }, t),
  priceLists: (t: string) => apiGet<PriceList[]>('/finance/price-lists', t),
  createPriceList: (t: string, body: { name: string; description?: string; active?: boolean }) =>
    apiPost<PriceList>('/finance/price-lists', body, t),
  updatePriceList: (t: string, id: string, body: { name?: string; description?: string; active?: boolean }) =>
    apiPut<PriceList>(`/finance/price-lists/${id}`, body, t),
  deletePriceListItem: (t: string, id: string, catalogId: string) =>
    apiDelete(`/finance/price-lists/${id}/items/${catalogId}`, undefined, t),
  servicePackages: (t: string) => apiGet<ServicePackage[]>('/finance/service-packages', t),
  createServicePackage: (
    t: string,
    body: { code: string; name: string; description?: string; fixedPrice: number; active?: boolean },
  ) => apiPost<ServicePackage>('/finance/service-packages', body, t),
  updateServicePackage: (
    t: string,
    id: string,
    body: { name?: string; description?: string; fixedPrice?: number; active?: boolean },
  ) => apiPut<ServicePackage>(`/finance/service-packages/${id}`, body, t),
  deleteServicePackageItem: (t: string, id: string, catalogId: string) =>
    apiDelete(`/finance/service-packages/${id}/items/${catalogId}`, undefined, t),
};
