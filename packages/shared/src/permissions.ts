// Canonical permission keys — "domain.action" strings. Single source of truth.
// Stored in the Permission table (global) and linked to roles per-tenant.

export const PERMISSIONS = {
  // ── Platform ──────────────────────────────────────────────
  PLATFORM_TENANT_READ: 'platform.tenant.read',
  PLATFORM_TENANT_CREATE: 'platform.tenant.create',
  PLATFORM_TENANT_UPDATE: 'platform.tenant.update',
  PLATFORM_TENANT_SUSPEND: 'platform.tenant.suspend',
  PLATFORM_MODULES_MANAGE: 'platform.modules.manage',
  PLATFORM_PLANS_MANAGE: 'platform.plans.manage',
  PLATFORM_ADMIN_INVITE: 'platform.admin.invite',
  PLATFORM_AUDIT_READ: 'platform.audit.read',

  // ── Hospital setup & staff ────────────────────────────────
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',
  FACILITY_READ: 'facility.read',
  FACILITY_WRITE: 'facility.write',
  DEPARTMENT_READ: 'department.read',
  DEPARTMENT_WRITE: 'department.write',
  ROLE_READ: 'role.read',
  ROLE_WRITE: 'role.write',
  STAFF_READ: 'staff.read',
  STAFF_INVITE: 'staff.invite',
  STAFF_UPDATE: 'staff.update',
  STAFF_DEACTIVATE: 'staff.deactivate',
  STAFF_RESET_PASSWORD: 'staff.reset_password',

  // ── Patient & OPD ─────────────────────────────────────────
  PATIENT_READ: 'patient.read',
  PATIENT_WRITE: 'patient.write',
  PATIENT_ARCHIVE: 'patient.archive',
  PATIENT_TIMELINE_READ: 'patient.timeline.read',
  PATIENT_CONSENT_MANAGE: 'patient.consent.manage',
  APPOINTMENT_READ: 'appointment.read',
  APPOINTMENT_WRITE: 'appointment.write',
  APPOINTMENT_CANCEL: 'appointment.cancel',
  APPOINTMENT_RESCHEDULE: 'appointment.reschedule',
  QUEUE_READ: 'queue.read',
  QUEUE_MANAGE: 'queue.manage',

  // ── Clinical ──────────────────────────────────────────────
  ENCOUNTER_READ: 'encounter.read',
  ENCOUNTER_WRITE: 'encounter.write',
  CONSULTATION_READ: 'consultation.read',
  CONSULTATION_WRITE: 'consultation.write',
  CLINICAL_NOTE_WRITE: 'clinical_note.write',
  VITALS_READ: 'vitals.read',
  VITALS_WRITE: 'vitals.write',
  DIAGNOSIS_WRITE: 'diagnosis.write',
  FOLLOWUP_WRITE: 'followup.write',
  PRESCRIPTION_READ: 'prescription.read',
  PRESCRIPTION_WRITE: 'prescription.write',
  PRESCRIPTION_FINALIZE: 'prescription.finalize',

  // ── Nursing ───────────────────────────────────────────────
  NURSING_READ: 'nursing.read',
  NURSING_NOTE_WRITE: 'nursing.note.write',
  MEDICATION_ADMINISTER: 'medication.administer',

  // ── Lab ───────────────────────────────────────────────────
  LAB_CATALOG_MANAGE: 'lab.catalog.manage',
  LAB_ORDER: 'lab.order',
  LAB_READ: 'lab.read',
  LAB_SAMPLE_COLLECT: 'lab.sample.collect',
  LAB_RESULT_ENTER: 'lab.result.enter',
  LAB_RESULT_VERIFY: 'lab.result.verify',
  LAB_REPORT_PRINT: 'lab.report.print',

  // ── Pharmacy & inventory ──────────────────────────────────
  PHARMACY_READ: 'pharmacy.read',
  PHARMACY_DISPENSE: 'pharmacy.dispense',
  PHARMACY_RETURN: 'pharmacy.return',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ITEM_WRITE: 'inventory.item.write',
  INVENTORY_STOCK_IN: 'inventory.stock_in',
  INVENTORY_STOCK_OUT: 'inventory.stock_out',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_SUPPLIER_MANAGE: 'inventory.supplier.manage',
  INVENTORY_PURCHASE_MANAGE: 'inventory.purchase.manage',
  INVENTORY_REPORTS_READ: 'inventory.reports.read',

  // ── Billing & accounts ────────────────────────────────────
  BILL_READ: 'bill.read',
  BILL_WRITE: 'bill.write',
  BILL_CANCEL: 'bill.cancel',
  INVOICE_PRINT: 'invoice.print',
  PAYMENT_COLLECT: 'payment.collect',
  PAYMENT_REFUND: 'payment.refund',
  REPORTS_FINANCIAL_READ: 'reports.financial.read',

  // ── IPD ───────────────────────────────────────────────────
  IPD_READ: 'ipd.read',
  IPD_ADMIT: 'ipd.admit',
  IPD_TRANSFER: 'ipd.transfer',
  IPD_DISCHARGE: 'ipd.discharge',
  IPD_ROUND_WRITE: 'ipd.round.write',
  IPD_CHARGE_WRITE: 'ipd.charge.write',
  WARD_MANAGE: 'ward.manage',
  BED_MANAGE: 'bed.manage',

  // ── Insurance ─────────────────────────────────────────────
  INSURANCE_READ: 'insurance.read',
  INSURANCE_PROVIDER_MANAGE: 'insurance.provider.manage',
  INSURANCE_POLICY_MANAGE: 'insurance.policy.manage',
  INSURANCE_CLAIM_CREATE: 'insurance.claim.create',
  INSURANCE_CLAIM_UPDATE: 'insurance.claim.update',
  INSURANCE_CLAIM_APPROVE: 'insurance.claim.approve',
  INSURANCE_CLAIM_SETTLE: 'insurance.claim.settle',

  // ── Reports ───────────────────────────────────────────────
  REPORTS_READ: 'reports.read',
  REPORTS_OPERATIONAL_READ: 'reports.operational.read',
  REPORTS_CLINICAL_READ: 'reports.clinical.read',
  REPORTS_INVENTORY_READ: 'reports.inventory.read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const PLATFORM_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.PLATFORM_TENANT_READ,
  PERMISSIONS.PLATFORM_TENANT_CREATE,
  PERMISSIONS.PLATFORM_TENANT_UPDATE,
  PERMISSIONS.PLATFORM_TENANT_SUSPEND,
  PERMISSIONS.PLATFORM_MODULES_MANAGE,
  PERMISSIONS.PLATFORM_PLANS_MANAGE,
  PERMISSIONS.PLATFORM_ADMIN_INVITE,
  PERMISSIONS.PLATFORM_AUDIT_READ,
];

// Human-readable description per key, for the Permission table.
export const PERMISSION_DESCRIPTIONS: Record<string, string> = ALL_PERMISSIONS.reduce(
  (acc, key) => {
    acc[key] = key
      .split('.')
      .map((p) => p.replace(/_/g, ' '))
      .join(' — ');
    return acc;
  },
  {} as Record<string, string>,
);
