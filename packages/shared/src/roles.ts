import { PERMISSIONS, ALL_PERMISSIONS, PLATFORM_PERMISSIONS, PermissionKey } from './permissions';

// Canonical roles. SUPER_ADMIN is a platform role (isPlatform users).
// The other 11 are tenant roles, bootstrapped per-tenant on creation.

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
  HOSPITAL_MANAGER: 'HOSPITAL_MANAGER',
  RECEPTION: 'RECEPTION',
  DOCTOR: 'DOCTOR',
  NURSE: 'NURSE',
  LAB_TECH: 'LAB_TECH',
  PHARMACIST: 'PHARMACIST',
  INVENTORY_MGR: 'INVENTORY_MGR',
  BILLING: 'BILLING',
  ACCOUNTANT: 'ACCOUNTANT',
  INSURANCE_STAFF: 'INSURANCE_STAFF',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LANDING: Record<RoleCode, string> = {
  SUPER_ADMIN: '/platform',
  HOSPITAL_ADMIN: '/admin',
  HOSPITAL_MANAGER: '/manager',
  RECEPTION: '/reception',
  DOCTOR: '/doctor',
  NURSE: '/nursing',
  LAB_TECH: '/lab',
  PHARMACIST: '/pharmacy',
  INVENTORY_MGR: '/inventory',
  BILLING: '/billing',
  ACCOUNTANT: '/accounts',
  INSURANCE_STAFF: '/insurance',
};

// Every tenant permission = all permissions except platform.* ones.
export const TENANT_PERMISSIONS: PermissionKey[] = ALL_PERMISSIONS.filter((p) => !PLATFORM_PERMISSIONS.includes(p));

const P = PERMISSIONS;

export interface RoleDef {
  code: RoleCode;
  name: string;
  description: string;
  /** Platform roles are not bootstrapped into tenants. */
  platform: boolean;
  /** Created automatically for every tenant. */
  systemRole: boolean;
  permissions: PermissionKey[];
}

export const ROLE_DEFS: RoleDef[] = [
  {
    code: ROLES.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'SaaS platform operator',
    platform: true,
    systemRole: true,
    permissions: [...PLATFORM_PERMISSIONS],
  },
  {
    code: ROLES.HOSPITAL_ADMIN,
    name: 'Hospital Admin',
    description: 'Full hospital management',
    platform: false,
    systemRole: true,
    permissions: [...TENANT_PERMISSIONS],
  },
  {
    code: ROLES.HOSPITAL_MANAGER,
    name: 'Hospital Manager',
    description: 'Operational oversight, reports, no destructive defaults',
    platform: false,
    systemRole: true,
    permissions: [
      P.SETTINGS_READ,
      P.FACILITY_READ,
      P.DEPARTMENT_READ,
      P.STAFF_READ,
      P.PATIENT_READ,
      P.PATIENT_TIMELINE_READ,
      P.APPOINTMENT_READ,
      P.QUEUE_READ,
      P.ENCOUNTER_READ,
      P.CONSULTATION_READ,
      P.VITALS_READ,
      P.PRESCRIPTION_READ,
      P.LAB_READ,
      P.PHARMACY_READ,
      P.INVENTORY_READ,
      P.INVENTORY_REPORTS_READ,
      P.BILL_READ,
      P.IPD_READ,
      P.INSURANCE_READ,
      P.REPORTS_READ,
      P.REPORTS_OPERATIONAL_READ,
      P.REPORTS_CLINICAL_READ,
      P.REPORTS_FINANCIAL_READ,
      P.REPORTS_INVENTORY_READ,
    ],
  },
  {
    code: ROLES.RECEPTION,
    name: 'Reception',
    description: 'Registration, appointments, OPD queue',
    platform: false,
    systemRole: true,
    permissions: [
      P.PATIENT_READ,
      P.PATIENT_WRITE,
      P.PATIENT_TIMELINE_READ,
      P.APPOINTMENT_READ,
      P.APPOINTMENT_WRITE,
      P.APPOINTMENT_CANCEL,
      P.APPOINTMENT_RESCHEDULE,
      P.QUEUE_READ,
      P.QUEUE_MANAGE,
      P.ENCOUNTER_READ,
      P.ENCOUNTER_WRITE,
      P.BILL_READ,
      P.BILL_WRITE,
      P.PAYMENT_COLLECT,
      P.INVOICE_PRINT,
    ],
  },
  {
    code: ROLES.DOCTOR,
    name: 'Doctor',
    description: 'Consultation, clinical work',
    platform: false,
    systemRole: true,
    permissions: [
      P.PATIENT_READ,
      P.PATIENT_TIMELINE_READ,
      P.APPOINTMENT_READ,
      P.QUEUE_READ,
      P.ENCOUNTER_READ,
      P.ENCOUNTER_WRITE,
      P.CONSULTATION_READ,
      P.CONSULTATION_WRITE,
      P.CLINICAL_NOTE_WRITE,
      P.VITALS_READ,
      P.VITALS_WRITE,
      P.DIAGNOSIS_WRITE,
      P.FOLLOWUP_WRITE,
      P.PRESCRIPTION_READ,
      P.PRESCRIPTION_WRITE,
      P.PRESCRIPTION_FINALIZE,
      P.LAB_ORDER,
      P.LAB_READ,
      P.IPD_READ,
      P.IPD_ADMIT,
      P.IPD_ROUND_WRITE,
    ],
  },
  {
    code: ROLES.NURSE,
    name: 'Nurse',
    description: 'Vitals, nursing notes, IPD care',
    platform: false,
    systemRole: true,
    permissions: [
      P.PATIENT_READ,
      P.PATIENT_TIMELINE_READ,
      P.ENCOUNTER_READ,
      P.VITALS_READ,
      P.VITALS_WRITE,
      P.NURSING_READ,
      P.NURSING_NOTE_WRITE,
      P.MEDICATION_ADMINISTER,
      P.IPD_READ,
      P.IPD_ROUND_WRITE,
      P.LAB_READ,
    ],
  },
  {
    code: ROLES.LAB_TECH,
    name: 'Lab Technician',
    description: 'Sample collection, result entry, reports',
    platform: false,
    systemRole: true,
    permissions: [
      P.PATIENT_READ,
      P.LAB_READ,
      P.LAB_SAMPLE_COLLECT,
      P.LAB_RESULT_ENTER,
      P.LAB_RESULT_VERIFY,
      P.LAB_REPORT_PRINT,
    ],
  },
  {
    code: ROLES.PHARMACIST,
    name: 'Pharmacist',
    description: 'Dispensing, pharmacy billing',
    platform: false,
    systemRole: true,
    permissions: [
      P.PATIENT_READ,
      P.PRESCRIPTION_READ,
      P.PHARMACY_READ,
      P.PHARMACY_DISPENSE,
      P.PHARMACY_RETURN,
      P.INVENTORY_READ,
      P.INVENTORY_STOCK_OUT,
      P.BILL_READ,
      P.BILL_WRITE,
      P.PAYMENT_COLLECT,
      P.INVOICE_PRINT,
    ],
  },
  {
    code: ROLES.INVENTORY_MGR,
    name: 'Inventory Manager',
    description: 'Stock, suppliers, purchasing',
    platform: false,
    systemRole: true,
    permissions: [
      P.INVENTORY_READ,
      P.INVENTORY_ITEM_WRITE,
      P.INVENTORY_STOCK_IN,
      P.INVENTORY_STOCK_OUT,
      P.INVENTORY_ADJUST,
      P.INVENTORY_SUPPLIER_MANAGE,
      P.INVENTORY_PURCHASE_MANAGE,
      P.INVENTORY_REPORTS_READ,
    ],
  },
  {
    code: ROLES.BILLING,
    name: 'Billing',
    description: 'Bills, payments, receipts, receivables',
    platform: false,
    systemRole: true,
    permissions: [
      P.PATIENT_READ,
      P.BILL_READ,
      P.BILL_WRITE,
      P.BILL_CANCEL,
      P.INVOICE_PRINT,
      P.PAYMENT_COLLECT,
      P.PAYMENT_REFUND,
      P.INSURANCE_READ,
      P.REPORTS_FINANCIAL_READ,
    ],
  },
  {
    code: ROLES.ACCOUNTANT,
    name: 'Accountant',
    description: 'Financial reports, refunds, reconciliation',
    platform: false,
    systemRole: true,
    permissions: [
      P.BILL_READ,
      P.BILL_CANCEL,
      P.INVOICE_PRINT,
      P.PAYMENT_REFUND,
      P.REPORTS_FINANCIAL_READ,
      P.INSURANCE_READ,
    ],
  },
  {
    code: ROLES.INSURANCE_STAFF,
    name: 'Insurance Staff',
    description: 'Policies, claims, settlements',
    platform: false,
    systemRole: true,
    permissions: [
      P.PATIENT_READ,
      P.BILL_READ,
      P.INSURANCE_READ,
      P.INSURANCE_PROVIDER_MANAGE,
      P.INSURANCE_POLICY_MANAGE,
      P.INSURANCE_CLAIM_CREATE,
      P.INSURANCE_CLAIM_UPDATE,
      P.INSURANCE_CLAIM_APPROVE,
      P.INSURANCE_CLAIM_SETTLE,
    ],
  },
];

/** Tenant roles only (everything bootstrapped into a tenant). */
export const TENANT_ROLE_DEFS: RoleDef[] = ROLE_DEFS.filter((r) => !r.platform);

export function roleDef(code: string): RoleDef | undefined {
  return ROLE_DEFS.find((r) => r.code === code);
}
