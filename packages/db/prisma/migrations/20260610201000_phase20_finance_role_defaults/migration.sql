-- Add Phase 20 finance permissions to existing tenant system roles.
-- Hospitals can still customize role permissions from Admin -> Roles after this default upgrade.

INSERT INTO role_permission ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r
JOIN (
  VALUES
    ('HOSPITAL_ADMIN', 'finance.read'),
    ('HOSPITAL_ADMIN', 'finance.cashier'),
    ('HOSPITAL_ADMIN', 'finance.patient_account.read'),
    ('HOSPITAL_ADMIN', 'finance.charge.manage'),
    ('HOSPITAL_ADMIN', 'finance.day_close'),
    ('HOSPITAL_ADMIN', 'finance.reconcile'),
    ('HOSPITAL_ADMIN', 'finance.approval.manage'),
    ('HOSPITAL_ADMIN', 'finance.write_off'),
    ('HOSPITAL_MANAGER', 'finance.read'),
    ('HOSPITAL_MANAGER', 'finance.patient_account.read'),
    ('RECEPTION', 'finance.read'),
    ('RECEPTION', 'finance.cashier'),
    ('RECEPTION', 'finance.patient_account.read'),
    ('RECEPTION', 'finance.charge.manage'),
    ('PHARMACIST', 'finance.read'),
    ('PHARMACIST', 'finance.cashier'),
    ('PHARMACIST', 'finance.patient_account.read'),
    ('BILLING', 'finance.read'),
    ('BILLING', 'finance.cashier'),
    ('BILLING', 'finance.patient_account.read'),
    ('BILLING', 'finance.charge.manage'),
    ('ACCOUNTANT', 'finance.read'),
    ('ACCOUNTANT', 'finance.patient_account.read'),
    ('ACCOUNTANT', 'finance.day_close'),
    ('ACCOUNTANT', 'finance.reconcile'),
    ('ACCOUNTANT', 'finance.approval.manage'),
    ('ACCOUNTANT', 'finance.write_off'),
    ('INSURANCE_STAFF', 'finance.read'),
    ('INSURANCE_STAFF', 'finance.patient_account.read')
) AS defaults(code, permission_key) ON defaults.code = r.code
JOIN permission p ON p.key = defaults.permission_key
WHERE r."tenant_id" IS NOT NULL
  AND r."systemRole" = true
ON CONFLICT DO NOTHING;
