import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { platformDb, Prisma, MODULES, ROLES } from '@hms/db';
import { createTenant as provisionTenant, provisionUser } from './provisioning';
import { CreateTenantDto, InviteAdminDto } from './dto';

@Injectable()
export class SuperAdminService {
  // ── Reads ───────────────────────────────────────────────────
  async listTenants() {
    const tenants = await platformDb.tenant.findMany({ orderBy: { createdAt: 'asc' } });
    return Promise.all(
      tenants.map(async (t) => {
        const [staffCount, moduleCount, sub] = await Promise.all([
          platformDb.tenantUser.count({ where: { tenantId: t.id, active: true } }),
          platformDb.moduleEntitlement.count({ where: { tenantId: t.id, enabled: true } }),
          platformDb.subscription.findFirst({ where: { tenantId: t.id }, orderBy: { createdAt: 'desc' } }),
        ]);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          tier: t.tier,
          contactEmail: t.contactEmail,
          staffCount,
          moduleCount,
          subscriptionStatus: sub?.status ?? null,
          createdAt: t.createdAt,
        };
      }),
    );
  }

  async getTenant(id: string) {
    const tenant = await platformDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [modules, sub, staffCount, admins] = await Promise.all([
      platformDb.moduleEntitlement.findMany({ where: { tenantId: id }, orderBy: { moduleCode: 'asc' } }),
      platformDb.subscription.findFirst({ where: { tenantId: id }, orderBy: { createdAt: 'desc' } }),
      platformDb.tenantUser.count({ where: { tenantId: id, active: true } }),
      this.listAdmins(id),
    ]);
    const plan = sub ? await platformDb.plan.findUnique({ where: { id: sub.planId } }) : null;
    return { ...tenant, modules, subscription: sub, plan, staffCount, admins };
  }

  private async listAdmins(tenantId: string) {
    const role = await platformDb.role.findUnique({
      where: { tenantId_code: { tenantId, code: ROLES.HOSPITAL_ADMIN } },
    });
    if (!role) return [];
    const userRoles = await platformDb.userRole.findMany({
      where: { roleId: role.id, tenantUser: { tenantId } },
      include: { tenantUser: { include: { user: true } } },
    });
    return userRoles.map((ur) => ({
      userId: ur.tenantUser.user.id,
      email: ur.tenantUser.user.email,
      fullName: ur.tenantUser.user.fullName,
      active: ur.tenantUser.active,
    }));
  }

  async listPlans() {
    return platformDb.plan.findMany({ where: { active: true }, orderBy: { priceInr: 'asc' } });
  }

  async listAudit(limit = 100) {
    return platformDb.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  async getModules(id: string) {
    const tenant = await platformDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return platformDb.moduleEntitlement.findMany({ where: { tenantId: id }, orderBy: { moduleCode: 'asc' } });
  }

  // ── Mutations ───────────────────────────────────────────────
  async createTenant(actorId: string, dto: CreateTenantDto) {
    const existing = await platformDb.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`A tenant with slug "${dto.slug}" already exists`);
    const { tenant } = await provisionTenant({
      name: dto.name,
      slug: dto.slug,
      planCode: dto.planCode,
      actorId,
      contactEmail: dto.contactEmail,
    });
    return this.getTenant(tenant.id);
  }

  async suspendTenant(actorId: string, id: string, reason: string) {
    const tenant = await platformDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const updated = await platformDb.tenant.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await this.audit(actorId, id, 'tenant.suspend', 'tenant', id, { reason });
    return updated;
  }

  async activateTenant(actorId: string, id: string) {
    const tenant = await platformDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const updated = await platformDb.tenant.update({ where: { id }, data: { status: 'ACTIVE' } });
    await this.audit(actorId, id, 'tenant.activate', 'tenant', id, {});
    return updated;
  }

  async setModule(actorId: string, id: string, moduleCode: string, enabled: boolean) {
    const tenant = await platformDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (moduleCode === MODULES.ADMIN && !enabled) {
      throw new BadRequestException('The ADMIN module is required and cannot be disabled');
    }
    const entitlement = await platformDb.moduleEntitlement.upsert({
      where: { tenantId_moduleCode: { tenantId: id, moduleCode } },
      update: { enabled, source: 'OVERRIDE' },
      create: { tenantId: id, moduleCode, enabled, source: 'OVERRIDE' },
    });
    await this.audit(actorId, id, 'platform.modules.manage', 'module_entitlement', entitlement.id, {
      moduleCode,
      enabled,
    });
    return entitlement;
  }

  async inviteAdmin(actorId: string, id: string, dto: InviteAdminDto) {
    const tenant = await platformDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const role = await platformDb.role.findUnique({
      where: { tenantId_code: { tenantId: id, code: ROLES.HOSPITAL_ADMIN } },
    });
    if (!role) throw new BadRequestException('Tenant roles are not bootstrapped — tenant creation may have failed');

    const { user } = await provisionUser({
      tenantId: id,
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      roleCode: ROLES.HOSPITAL_ADMIN,
      roleId: role.id,
      actorId,
    });
    await this.audit(actorId, id, 'platform.admin.invite', 'user', user.id, { email: dto.email });
    return { userId: user.id, email: user.email, fullName: user.fullName };
  }

  private async audit(
    actorId: string,
    tenantId: string | null,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await platformDb.platformAuditLog.create({
      data: { actorId, tenantId, action, entity, entityId, metadata: metadata as Prisma.InputJsonValue },
    });
  }
}
