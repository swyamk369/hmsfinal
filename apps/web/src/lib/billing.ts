import { apiGet, apiPost } from './api';

interface PatientRef {
  id: string;
  fullName: string;
  mrn: string;
  phone?: string | null;
}

export interface BillItem {
  id: string;
  catalogId: string | null;
  sourceType: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
export interface Payment {
  id: string;
  amount: number;
  method: string;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
}
export interface Refund {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}
export interface Bill {
  id: string;
  billNumber: string;
  patientId: string;
  encounterId: string | null;
  totalAmount: number;
  discount: number;
  netAmount: number;
  status: string;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: string;
  items: BillItem[];
  payments: Payment[];
  refunds: Refund[];
  patient?: PatientRef;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  type: string;
  price: number;
  taxRate: number;
}

export interface BillingStats {
  unpaidCount: number;
  partialCount: number;
  totalBills: number;
  paidToday: number;
  outstandingReceivables: number;
}

export interface Invoice {
  bill: Bill;
  hospital: { name: string; address: string | null; phone: string | null; email: string | null; currency: string };
  paid: number;
  refunded: number;
  balanceDue: number;
}

export const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'INSURANCE', 'OTHER'] as const;

export const billingApi = {
  catalog: (t: string) => apiGet<CatalogItem[]>('/billing/catalog', t),
  stats: (t: string) => apiGet<BillingStats>('/billing/stats', t),
  list: (t: string, params: Record<string, string> = {}) => apiGet<Bill[]>(`/billing/bills${qs(params)}`, t),
  get: (t: string, id: string) => apiGet<Bill>(`/billing/bills/${id}`, t),
  create: (
    t: string,
    body: {
      patientId: string;
      encounterId?: string;
      discount?: number;
      notes?: string;
      items: { catalogId?: string; name: string; quantity: number; unitPrice: number; sourceType?: string }[];
    },
  ) => apiPost<Bill>('/billing/bills', body, t),
  pay: (t: string, id: string, body: { amount: number; method: string; transactionId?: string; notes?: string }) =>
    apiPost<Bill>(`/billing/bills/${id}/payments`, body, t),
  cancel: (t: string, id: string, reason: string) => apiPost<Bill>(`/billing/bills/${id}/cancel`, { reason }, t),
  refund: (t: string, id: string, amount: number, reason: string) =>
    apiPost<Bill>(`/billing/bills/${id}/refunds`, { amount, reason }, t),
  invoice: (t: string, id: string) => apiGet<Invoice>(`/billing/bills/${id}/invoice`, t),
};

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

export function outstanding(bill: Bill): number {
  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  const refunded = bill.refunds.reduce((s, r) => s + r.amount, 0);
  return Math.max(0, bill.netAmount - (paid - refunded));
}
export function collected(bill: Bill): number {
  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  const refunded = bill.refunds.reduce((s, r) => s + r.amount, 0);
  return paid - refunded;
}
