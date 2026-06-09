import { apiGet, apiPost, apiPatch } from './api';

// ── Types ───────────────────────────────────────────────────────
export interface HospitalProfile {
  name: string;
  slug: string;
  tier: string;
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  invoicePrefix: string;
  mrnPrefix: string;
}

export interface Facility {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  type: string | null;
  facilityId: string | null;
  active: boolean;
  facility: { id: string; name: string } | null;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  type: string;
  price: number; // minor units
  taxRate: number; // basis points
  active: boolean;
}

export interface Bed {
  id: string;
  wardId: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
}

export interface Ward {
  id: string;
  name: string;
  type: string;
  active: boolean;
  beds: Bed[];
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  specimenType: string | null;
  price: number; // minor units
  active: boolean;
}

export interface InsuranceProvider {
  id: string;
  name: string;
  contact: string | null;
  active: boolean;
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export interface AdminOverview {
  profile: HospitalProfile & { complete: boolean };
  modules: { lab: boolean; insurance: boolean; ipd: boolean };
  counts: {
    facilities: number;
    departments: number;
    catalog: number;
    wards: number;
    beds: number;
    labTests: number;
    insuranceProviders: number;
    staff: number;
  };
  beds: { total: number; AVAILABLE: number; OCCUPIED: number; MAINTENANCE: number; RESERVED: number };
  checklist: ChecklistItem[];
  progress: { completed: number; total: number };
}

// ── Catalog / ward enum option sets ─────────────────────────────
export const CATALOG_TYPES = ['CONSULTATION', 'PROCEDURE', 'LAB', 'BED', 'OTHER'] as const;
export const WARD_TYPES = ['GENERAL', 'PRIVATE', 'ICU', 'HDU', 'MATERNITY', 'PEDIATRIC'] as const;
export const BED_STATUSES = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'] as const;

// ── API client (tenant-scoped via X-Tenant-Id) ──────────────────
export const adminApi = {
  overview: (t: string) => apiGet<AdminOverview>('/admin/overview', t),

  getProfile: (t: string) => apiGet<HospitalProfile>('/admin/profile', t),
  updateProfile: (t: string, body: Partial<HospitalProfile>) => apiPatch<HospitalProfile>('/admin/profile', body, t),

  listFacilities: (t: string) => apiGet<Facility[]>('/admin/facilities', t),
  createFacility: (t: string, body: { name: string; address?: string; phone?: string }) =>
    apiPost<Facility>('/admin/facilities', body, t),
  updateFacility: (t: string, id: string, body: Partial<Facility>) =>
    apiPatch<Facility>(`/admin/facilities/${id}`, body, t),

  listDepartments: (t: string) => apiGet<Department[]>('/admin/departments', t),
  createDepartment: (t: string, body: { name: string; facilityId?: string; type?: string }) =>
    apiPost<Department>('/admin/departments', body, t),
  updateDepartment: (t: string, id: string, body: Partial<Department>) =>
    apiPatch<Department>(`/admin/departments/${id}`, body, t),

  listCatalog: (t: string) => apiGet<CatalogItem[]>('/admin/catalog', t),
  createCatalogItem: (t: string, body: { code: string; name: string; type: string; price: number; taxRate?: number }) =>
    apiPost<CatalogItem>('/admin/catalog', body, t),
  updateCatalogItem: (t: string, id: string, body: Partial<CatalogItem>) =>
    apiPatch<CatalogItem>(`/admin/catalog/${id}`, body, t),

  listWards: (t: string) => apiGet<Ward[]>('/admin/wards', t),
  createWard: (t: string, body: { name: string; type?: string }) => apiPost<Ward>('/admin/wards', body, t),
  updateWard: (t: string, id: string, body: Partial<Ward>) => apiPatch<Ward>(`/admin/wards/${id}`, body, t),

  createBed: (t: string, body: { wardId: string; bedNumber: string; status?: string }) =>
    apiPost<Bed>('/admin/beds', body, t),
  updateBed: (t: string, id: string, body: { bedNumber?: string; status?: string }) =>
    apiPatch<Bed>(`/admin/beds/${id}`, body, t),

  listLabTests: (t: string) => apiGet<LabTest[]>('/admin/lab-catalog', t),
  createLabTest: (t: string, body: { code: string; name: string; specimenType?: string; price: number }) =>
    apiPost<LabTest>('/admin/lab-catalog', body, t),
  updateLabTest: (t: string, id: string, body: Partial<LabTest>) =>
    apiPatch<LabTest>(`/admin/lab-catalog/${id}`, body, t),

  listInsuranceProviders: (t: string) => apiGet<InsuranceProvider[]>('/admin/insurance-providers', t),
  createInsuranceProvider: (t: string, body: { name: string; contact?: string }) =>
    apiPost<InsuranceProvider>('/admin/insurance-providers', body, t),
  updateInsuranceProvider: (t: string, id: string, body: Partial<InsuranceProvider>) =>
    apiPatch<InsuranceProvider>(`/admin/insurance-providers/${id}`, body, t),
};

// ── Money helpers (API stores minor units; UI shows human currency) ──
const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? `${code} `;
}

/** minor units → display string, e.g. 50000 → "₹500.00". */
export function formatMoney(minor: number, currency = 'INR'): string {
  return (
    currencySymbol(currency) +
    (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Display amount (major units, e.g. "500" or "500.50") → minor units integer. Returns null if invalid. */
export function parseMoneyToMinor(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '').trim();
  if (cleaned === '' || Number.isNaN(Number(cleaned))) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Basis points → percent display, e.g. 500 → "5". */
export function bpsToPercent(bps: number): string {
  return (bps / 100).toString();
}

/** Percent input → basis points, e.g. "5" → 500. Returns null if invalid. */
export function percentToBps(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '').trim();
  if (cleaned === '') return 0;
  if (Number.isNaN(Number(cleaned))) return null;
  return Math.round(Number(cleaned) * 100);
}
