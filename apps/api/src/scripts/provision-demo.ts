import '../load-env';
import { platformDb, PLAN_CODES, ROLES } from '@hms/db';
import { firebaseConfigured } from '../common/firebase-credentials';
import { createTenant, provisionUser } from '../platform/provisioning';

/**
 * DEV ONLY — not part of the production seed. Provisions a demo hospital on the
 * ENTERPRISE plan (every module enabled, so every role's dashboard is reachable)
 * with one REAL Firebase user per tenant role. Idempotent. Shared password.
 *
 *   pnpm --filter @hms/api provision:demo
 */
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo-2026!';

async function dept(tenantId: string, name: string) {
  const found = await platformDb.department.findFirst({ where: { tenantId, name } });
  return found ?? platformDb.department.create({ data: { tenantId, name, type: 'CLINICAL' } });
}

async function main(): Promise<void> {
  if (!firebaseConfigured()) {
    console.error('Firebase is not configured.');
    process.exit(1);
  }

  console.log('Provisioning demo hospital (ENTERPRISE)…');
  const { tenant, roleMap } = await createTenant({
    name: 'Demo Hospital',
    slug: 'demo-hospital',
    planCode: PLAN_CODES.ENTERPRISE,
    contactEmail: 'contact@demo.local',
  });

  const medicine = await dept(tenant.id, 'General Medicine');
  const nursing = await dept(tenant.id, 'Nursing');

  const users: Array<{
    role: string;
    email: string;
    name: string;
    providerType?: 'DOCTOR' | 'NURSE';
    departmentId?: string;
    speciality?: string;
  }> = [
    { role: ROLES.HOSPITAL_ADMIN, email: 'admin@demo.local', name: 'Aarti Admin' },
    { role: ROLES.HOSPITAL_MANAGER, email: 'manager@demo.local', name: 'Manish Manager' },
    { role: ROLES.RECEPTION, email: 'reception@demo.local', name: 'Riya Reception' },
    {
      role: ROLES.DOCTOR,
      email: 'doctor@demo.local',
      name: 'Dr. Dev Sharma',
      providerType: 'DOCTOR',
      departmentId: medicine.id,
      speciality: 'General Physician',
    },
    {
      role: ROLES.NURSE,
      email: 'nurse@demo.local',
      name: 'Nita Nurse',
      providerType: 'NURSE',
      departmentId: nursing.id,
    },
    { role: ROLES.LAB_TECH, email: 'labtech@demo.local', name: 'Lalit Lab' },
    { role: ROLES.PHARMACIST, email: 'pharmacist@demo.local', name: 'Priya Pharma' },
    { role: ROLES.INVENTORY_MGR, email: 'inventory@demo.local', name: 'Inder Inventory' },
    { role: ROLES.BILLING, email: 'billing@demo.local', name: 'Bina Billing' },
    { role: ROLES.ACCOUNTANT, email: 'accountant@demo.local', name: 'Anil Accountant' },
    { role: ROLES.INSURANCE_STAFF, email: 'insurance@demo.local', name: 'Isha Insurance' },
  ];

  for (const u of users) {
    await provisionUser({
      tenantId: tenant.id,
      email: u.email,
      password: PASSWORD,
      fullName: u.name,
      roleCode: u.role,
      roleId: roleMap.get(u.role),
      providerType: u.providerType,
      departmentId: u.departmentId,
      speciality: u.speciality,
    });
    console.log(`  ✓ ${u.role.padEnd(17)} ${u.email}`);
  }

  console.log(`\n✅ Demo hospital ready. ${users.length} users, password for all: ${PASSWORD}`);
  await platformDb.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
