// Canonical module codes. The ONLY source of truth for module identifiers.
// Used by seed, tenant bootstrap, the ModuleGuard, and the frontend nav.

export const MODULES = {
  ADMIN: 'ADMIN',
  PATIENT: 'PATIENT',
  OPD: 'OPD',
  SCHEDULING: 'SCHEDULING',
  BILLING: 'BILLING',
  LAB: 'LAB',
  PHARMACY: 'PHARMACY',
  INVENTORY: 'INVENTORY',
  IPD: 'IPD',
  INSURANCE: 'INSURANCE',
  REPORTS: 'REPORTS',
} as const;

export type ModuleCode = (typeof MODULES)[keyof typeof MODULES];

export const ALL_MODULES: ModuleCode[] = Object.values(MODULES);

export interface ModuleDef {
  code: ModuleCode;
  name: string;
  description: string;
}

export const MODULE_DEFS: ModuleDef[] = [
  { code: MODULES.ADMIN, name: 'Hospital Admin Setup', description: 'Settings, departments, staff, catalog' },
  { code: MODULES.PATIENT, name: 'Patient Records', description: 'Registration, profile, timeline' },
  { code: MODULES.OPD, name: 'OPD & Consultation', description: 'Appointments, queue, consultation' },
  { code: MODULES.SCHEDULING, name: 'Scheduling', description: 'Doctor schedules and appointment slots' },
  { code: MODULES.BILLING, name: 'Billing & Payments', description: 'Bills, payments, invoices, receipts' },
  { code: MODULES.LAB, name: 'Laboratory', description: 'Orders, samples, results, reports' },
  { code: MODULES.PHARMACY, name: 'Pharmacy', description: 'Prescription dispensing' },
  { code: MODULES.INVENTORY, name: 'Inventory', description: 'Stock, batches, suppliers, purchasing' },
  { code: MODULES.IPD, name: 'Inpatient (IPD)', description: 'Wards, beds, admissions, discharge' },
  { code: MODULES.INSURANCE, name: 'Insurance & TPA', description: 'Policies, claims, settlements' },
  { code: MODULES.REPORTS, name: 'Reports', description: 'Operational, clinical, financial reports' },
];
