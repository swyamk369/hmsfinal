import * as admin from 'firebase-admin';
import { platformDb, TENANT_ROLE_DEFS, ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS, modulesForPlan } from '@hms/db';
import { getFirebaseApp } from '../common/firebase-credentials';

/**
 * Tenant + user provisioning. These are the real building blocks used by the
 * platform (Phase 4) — Super Admin tenant creation and admin/staff invites — and
 * are also invoked by the dev `provision-demo` script.
 */

export async function ensurePermissions(): Promise<Map<string, string>> {
  for (const key of ALL_PERMISSIONS) {
    await platformDb.permission.upsert({
      where: { key },
      update: { description: PERMISSION_DESCRIPTIONS[key] },
      create: { key, description: PERMISSION_DESCRIPTIONS[key] },
    });
  }
  const all = await platformDb.permission.findMany();
  return new Map(all.map((p) => [p.key, p.id]));
}

/** Create the tenant's roles (from canonical defs) and their permission links. */
export async function bootstrapTenantRoles(tenantId: string): Promise<Map<string, string>> {
  const permMap = await ensurePermissions();
  const roleMap = new Map<string, string>();

  for (const def of TENANT_ROLE_DEFS) {
    const role = await platformDb.role.upsert({
      where: { tenantId_code: { tenantId, code: def.code } },
      update: { name: def.name, description: def.description, systemRole: true },
      create: { tenantId, code: def.code, name: def.name, description: def.description, systemRole: true },
    });
    roleMap.set(def.code, role.id);

    await platformDb.rolePermission.deleteMany({ where: { roleId: role.id } });
    const links = def.permissions
      .map((k) => permMap.get(k))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: role.id, permissionId }));
    if (links.length) {
      await platformDb.rolePermission.createMany({ data: links, skipDuplicates: true });
    }
  }
  return roleMap;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  planCode: string;
  actorId?: string | null;
  contactEmail?: string;
}

export async function createTenant(input: CreateTenantInput) {
  const existing = await platformDb.tenant.findUnique({ where: { slug: input.slug } });
  const tenant = existing
    ? await platformDb.tenant.update({
        where: { id: existing.id },
        data: { name: input.name, tier: input.planCode, status: 'ACTIVE' },
      })
    : await platformDb.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          tier: input.planCode,
          status: 'ACTIVE',
          contactEmail: input.contactEmail,
        },
      });

  const plan = await platformDb.plan.findUnique({ where: { code: input.planCode } });
  if (plan) {
    const sub = await platformDb.subscription.findFirst({ where: { tenantId: tenant.id } });
    if (!sub) {
      await platformDb.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      });
    }
  }

  for (const code of modulesForPlan(input.planCode as any)) {
    await platformDb.moduleEntitlement.upsert({
      where: { tenantId_moduleCode: { tenantId: tenant.id, moduleCode: code } },
      update: { enabled: true, source: 'PLAN' },
      create: { tenantId: tenant.id, moduleCode: code, enabled: true, source: 'PLAN' },
    });
  }

  await platformDb.hospitalSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, mrnPrefix: input.slug.slice(0, 3).toUpperCase(), invoicePrefix: 'INV' },
  });

  const roleMap = await bootstrapTenantRoles(tenant.id);

  if (!existing) {
    await platformDb.platformAuditLog.create({
      data: {
        actorId: input.actorId ?? null,
        tenantId: tenant.id,
        action: 'tenant.create',
        entity: 'tenant',
        entityId: tenant.id,
        metadata: { plan: input.planCode },
      },
    });
  }

  return { tenant, roleMap };
}

export interface ProvisionUserInput {
  tenantId: string;
  email: string;
  password: string;
  fullName: string;
  roleCode: string;
  roleId?: string;
  providerType?: 'DOCTOR' | 'NURSE';
  departmentId?: string;
  speciality?: string;
  actorId?: string | null;
}

/** Create a Firebase user + app user + active membership + role (+ provider). */
export async function provisionUser(input: ProvisionUserInput) {
  const auth = admin.auth(getFirebaseApp());
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(input.email)).uid;
  } catch {
    uid = (await auth.createUser({ email: input.email, password: input.password, displayName: input.fullName })).uid;
  }

  const user = await platformDb.user.upsert({
    where: { email: input.email },
    update: { fullName: input.fullName, firebaseUid: uid, isPlatform: false, disabledAt: null },
    create: { email: input.email, fullName: input.fullName, firebaseUid: uid, isPlatform: false },
  });

  const membership = await platformDb.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: input.tenantId, userId: user.id } },
    update: { active: true, deactivatedAt: null, deactivationReason: null },
    create: { tenantId: input.tenantId, userId: user.id, active: true },
  });

  let roleId = input.roleId;
  if (!roleId) {
    const role = await platformDb.role.findUnique({
      where: { tenantId_code: { tenantId: input.tenantId, code: input.roleCode } },
    });
    roleId = role?.id;
  }
  if (roleId) {
    await platformDb.userRole.upsert({
      where: { tenantUserId_roleId: { tenantUserId: membership.id, roleId } },
      update: {},
      create: { tenantUserId: membership.id, roleId },
    });
  }

  if (input.providerType) {
    await platformDb.provider.upsert({
      where: { tenantId_userId: { tenantId: input.tenantId, userId: user.id } },
      update: {
        type: input.providerType,
        speciality: input.speciality,
        departmentId: input.departmentId,
        active: true,
      },
      create: {
        tenantId: input.tenantId,
        userId: user.id,
        type: input.providerType,
        speciality: input.speciality,
        departmentId: input.departmentId,
        active: true,
      },
    });
  }

  return { user, uid };
}
