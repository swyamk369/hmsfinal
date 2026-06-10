import { apiGet } from './api';

export interface DashboardReport {
  generatedAt: string;
  roles: string[];
  enabledModules: string[];
  setup: any | null;
  opd: any | null;
  billing: any | null;
  lab: any | null;
  pharmacy: any | null;
  inventory: any | null;
  ipd: any | null;
  nursing: any | null;
  insurance: any | null;
  alerts: { label: string; tone: string; href: string }[];
  commandCenter?: Record<string, number>;
}

export interface OperationsReport {
  generatedAt: string;
  range: { start: string; end: string };
  totals: Record<string, number>;
  registrationsByDate: { date: string; count: number }[];
  appointmentStatus: Record<string, number>;
  encounterStatus: Record<string, number>;
  encounterType: Record<string, number>;
  labStatus: Record<string, number>;
  pharmacyStatus: Record<string, number>;
  admissionStatus: Record<string, number>;
  rows: { type: string; status: string; date: string }[];
}

export interface FinancialReport {
  generatedAt: string;
  range: { start: string; end: string };
  totals: Record<string, number>;
  billStatus: Record<string, number>;
  paymentMethod: Record<string, number>;
  insuranceStatus: Record<string, number>;
  rows: Record<string, any>[];
  insuranceRows: Record<string, any>[];
}

export interface InventoryReport {
  generatedAt: string;
  range: { start: string; end: string };
  totals: Record<string, number>;
  transactionType: Record<string, number>;
  purchaseStatus: Record<string, number>;
  supplierSummary: Record<string, any>[];
  lowStock: Record<string, any>[];
  expiringBatches: Record<string, any>[];
  rows: Record<string, any>[];
  purchaseRows: Record<string, any>[];
}

export interface ClinicalReport {
  generatedAt: string;
  range: { start: string; end: string };
  totals: Record<string, number>;
  encounterStatus: Record<string, number>;
  diagnosisCounts: Record<string, number>;
  labAbnormalFlags: Record<string, number>;
  rows: Record<string, any>[];
}

export const reportsApi = {
  dashboard: (t: string) => apiGet<DashboardReport>('/reports/dashboard', t),
  manager: (t: string) => apiGet<DashboardReport>('/reports/manager', t),
  operations: (t: string, params: Record<string, string> = {}) =>
    apiGet<OperationsReport>(`/reports/operations${qs(params)}`, t),
  financial: (t: string, params: Record<string, string> = {}) =>
    apiGet<FinancialReport>(`/reports/financial${qs(params)}`, t),
  inventory: (t: string, params: Record<string, string> = {}) =>
    apiGet<InventoryReport>(`/reports/inventory${qs(params)}`, t),
  clinical: (t: string, params: Record<string, string> = {}) =>
    apiGet<ClinicalReport>(`/reports/clinical${qs(params)}`, t),
};

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  return entries.length ? `?${new URLSearchParams(Object.fromEntries(entries)).toString()}` : '';
}

export function csvFromRows(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headerSet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((key) => headerSet.add(key)));
  const headers = Array.from(headerSet);
  const escape = (value: unknown) => {
    const raw = value instanceof Date ? value.toISOString() : value == null ? '' : String(value);
    const normalized = raw.replace(/\r?\n/g, ' ');
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}

export function downloadCsv(filename: string, rows: Record<string, any>[]): void {
  if (typeof window === 'undefined') return;
  const csv = csvFromRows(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function pairs(record: Record<string, number> | null | undefined): { label: string; value: number }[] {
  return Object.entries(record ?? {}).map(([label, value]) => ({ label, value }));
}
