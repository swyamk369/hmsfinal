// Role landing pages and navigation. Mirrors @hms/db canonical values but kept
// standalone so the browser bundle never imports the Prisma client.

export const MODULE_CODES = [
  'ADMIN',
  'PATIENT',
  'OPD',
  'SCHEDULING',
  'BILLING',
  'LAB',
  'PHARMACY',
  'INVENTORY',
  'IPD',
  'INSURANCE',
  'REPORTS',
] as const;

export const MODULE_LABELS: Record<string, string> = {
  ADMIN: 'Hospital Admin Setup',
  PATIENT: 'Patient Records',
  OPD: 'OPD & Consultation',
  SCHEDULING: 'Scheduling',
  BILLING: 'Billing & Payments',
  LAB: 'Laboratory',
  PHARMACY: 'Pharmacy',
  INVENTORY: 'Inventory',
  IPD: 'Inpatient (IPD)',
  INSURANCE: 'Insurance & TPA',
  REPORTS: 'Reports',
};

// Canonical role landing map comes from the shared product contract.
// Widened to Record<string, string> so UI code can index it with a plain role string.
import { ROLE_LANDING as SHARED_ROLE_LANDING } from '@hms/shared';
export const ROLE_LANDING: Record<string, string> = SHARED_ROLE_LANDING;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  HOSPITAL_ADMIN: 'Hospital Admin',
  HOSPITAL_MANAGER: 'Hospital Manager',
  RECEPTION: 'Reception',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  LAB_TECH: 'Lab Technician',
  PHARMACIST: 'Pharmacist',
  INVENTORY_MGR: 'Inventory Manager',
  BILLING: 'Billing',
  ACCOUNTANT: 'Accountant',
  INSURANCE_STAFF: 'Insurance Staff',
};

export interface NavItem {
  label: string;
  href: string;
  /** Hidden unless the active tenant has this module enabled. */
  module?: string;
  /** Hidden unless the user holds one of these roles (empty = any role). */
  roles?: string[];
  /** Hidden unless the user holds one of these permissions (empty = no check). */
  permission?: string[];
}

export const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Manager', href: '/manager', roles: ['HOSPITAL_MANAGER', 'HOSPITAL_ADMIN'] },
  { label: 'Reception', href: '/reception', module: 'OPD', roles: ['RECEPTION', 'HOSPITAL_ADMIN'] },
  {
    label: 'OPD Queue',
    href: '/opd',
    module: 'OPD',
    roles: ['RECEPTION', 'DOCTOR', 'HOSPITAL_ADMIN'],
    permission: ['queue.read', 'encounter.read'],
  },
  { label: 'Patients', href: '/patients', module: 'PATIENT' },
  { label: 'Doctor', href: '/doctor', module: 'OPD', roles: ['DOCTOR', 'HOSPITAL_ADMIN'] },
  { label: 'Nursing', href: '/nursing', roles: ['NURSE', 'HOSPITAL_ADMIN'] },
  { label: 'Lab', href: '/lab', module: 'LAB', roles: ['LAB_TECH', 'DOCTOR', 'HOSPITAL_ADMIN'] },
  { label: 'Pharmacy', href: '/pharmacy', module: 'PHARMACY', roles: ['PHARMACIST', 'HOSPITAL_ADMIN'] },
  {
    label: 'Inventory',
    href: '/inventory',
    module: 'INVENTORY',
    roles: ['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN'],
  },
  { label: 'IPD', href: '/ipd', module: 'IPD', roles: ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'] },
  {
    label: 'Finance',
    href: '/finance',
    module: 'BILLING',
    permission: [
      'finance.read',
      'finance.cashier',
      'finance.patient_account.read',
      'bill.read',
      'bill.write',
      'payment.collect',
      'reports.financial.read',
    ],
  },
  {
    label: 'Insurance',
    href: '/insurance',
    module: 'INSURANCE',
    roles: ['INSURANCE_STAFF', 'BILLING', 'HOSPITAL_ADMIN'],
  },
  {
    label: 'Reports',
    href: '/reports',
    module: 'REPORTS',
    roles: ['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'ACCOUNTANT'],
  },
  { label: 'Admin', href: '/admin', roles: ['HOSPITAL_ADMIN'] },
];

// Platform (Super Admin) navigation — never shown to tenant users.
export const PLATFORM_NAV: NavItem[] = [
  { label: 'Tenants', href: '/platform' },
  { label: 'Plans', href: '/platform/plans' },
  { label: 'Audit Log', href: '/platform/audit' },
];

// Human labels for path segments, used by breadcrumbs.
export const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  platform: 'Platform',
  profile: 'Profile',
  facilities: 'Facilities',
  departments: 'Departments',
  staff: 'Staff',
  roles: 'Roles',
  catalog: 'Catalog',
  wards: 'Wards & Beds',
  'lab-catalog': 'Lab Tests',
  insurance: 'Insurance',
  tenants: 'Tenants',
  plans: 'Plans',
  audit: 'Audit Log',
  search: 'Search',
  settings: 'Settings',
  account: 'Account',
  notifications: 'Notifications',
  support: 'Support',
  workflows: 'Workflows',
  troubleshooting: 'Troubleshooting',
  reception: 'Reception',
  patients: 'Patients',
  doctor: 'Doctor',
  nursing: 'Nursing',
  lab: 'Lab',
  pharmacy: 'Pharmacy',
  inventory: 'Inventory',
  ipd: 'IPD',
  finance: 'Finance',
  cashier: 'Cashier',
  'pending-charges': 'Pending Charges',
  'patient-accounts': 'Patient Accounts',
  payments: 'Payments',
  refunds: 'Refunds',
  'insurance-receivables': 'Insurance Receivables',
  'day-close': 'Day Close',
  approvals: 'Approvals',
  billing: 'Billing',
  accounts: 'Accounts',
  reports: 'Reports',
  manager: 'Manager',
  opd: 'OPD',
  dashboard: 'Dashboard',
};
