/* eslint-disable no-console */
// Production seed: canonical reference data ONLY — plans and permissions.
// No tenants, no users, no fake auth. The first Super Admin is created by the
// bootstrap script (apps/api); tenants/roles are bootstrapped on tenant creation.
import { PrismaClient } from '@prisma/client';
import { PLAN_DEFS, ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS } from '../src/constants';

const prisma = new PrismaClient();

async function seedPlans() {
  for (const p of PLAN_DEFS) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        priceInr: p.priceInr,
        priceUsd: p.priceUsd,
        interval: p.interval,
        userLimit: p.userLimit,
        facilityLimit: p.facilityLimit,
        bedLimit: p.bedLimit,
        modules: p.modules,
        active: true,
      },
      create: {
        code: p.code,
        name: p.name,
        priceInr: p.priceInr,
        priceUsd: p.priceUsd,
        interval: p.interval,
        userLimit: p.userLimit,
        facilityLimit: p.facilityLimit,
        bedLimit: p.bedLimit,
        modules: p.modules,
      },
    });
  }
  console.log(`✓ ${PLAN_DEFS.length} plans`);
}

async function seedPermissions() {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSION_DESCRIPTIONS[key] },
      create: { key, description: PERMISSION_DESCRIPTIONS[key] },
    });
  }
  console.log(`✓ ${ALL_PERMISSIONS.length} permissions`);
}

async function main() {
  console.log('Seeding canonical reference data…');
  await seedPlans();
  await seedPermissions();
  console.log('✅ Seed complete (plans + permissions).');
  console.log('   Next: create the first Super Admin via `pnpm --filter @hms/api bootstrap:superadmin`.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
