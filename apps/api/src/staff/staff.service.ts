import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { platformDb, ROLES, ROLE_LANDING, type RoleCode } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { FirebaseService } from '../common/firebase.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { InviteStaffDto, UpdateProviderDto, UpdateRolesDto, UpdateStaffDto } from './dto';

const PROVIDER_ROLES = new Set<string>([ROLES.DOCTOR, ROLES.NURSE]);

/**
 * Staff & provider management. Identity (User/TenantUser/Role/UserRole/Provider)
 * is handled through `platformDb`, the same cross-tenant identity client used by
 * platform provisioning — every query is strictly filtered by `ctx.tenantId`.
 * Tenant context is enforced via `requireDb(ctx)` (also the audit client), so a
 * platform user with no active tenant cannot mutate. Firebase is the only auth
 * store; no passwords are ever persisted.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly audit: AuditService,
    private readonly firebase: FirebaseService,
  ) {}

  private scope(ctx: RequestContext) {
    const auditDb = requireDb(ctx); // throws 400 if no tenant context
    return { tenantId: ctx.tenantId!, actorId: ctx.userId, auditDb };
  }

  private async record(
    s: ReturnType<StaffService['scope']>,
    action: string,
    entity: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.log(s.auditDb, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  private providerType(roles: string[]): 'DOCTOR' | 'NURSE' | null {
    if (roles.includes(ROLES.DOCTOR)) return 'DOCTOR';
    if (roles.includes(ROLES.NURSE)) return 'NURSE';
    return null;
  }

  private async assertDepartment(tenantId: string, departmentId?: string) {
    if (!departmentId) return;
    const dept = await platformDb.department.findFirst({ where: { id: departmentId, tenantId } });
    if (!dept) throw new BadRequestException('Department not found in this hospital');
  }

  // ── Listing / detail ──────────────────────────────────────────
  async list(ctx: RequestContext) {
    const tenantId = this.scope(ctx).tenantId;
    const [members, providers, departments] = await Promise.all([
      platformDb.tenantUser.findMany({
        where: { tenantId },
        include: { user: true, roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      platformDb.provider.findMany({ where: { tenantId } }),
      platformDb.department.findMany({ where: { tenantId } }),
    ]);
    const providerByUser = new Map(providers.map((p) => [p.userId, p]));
    const deptById = new Map(departments.map((d) => [d.id, d.name]));
    return members.map((m) => this.mapStaff(m, providerByUser, deptById));
  }

  async getById(ctx: RequestContext, id: string) {
    const tenantId = this.scope(ctx).tenantId;
    const member = await platformDb.tenantUser.findFirst({
      where: { id, tenantId },
      include: { user: true, roles: { include: { role: true } } },
    });
    if (!member) throw new NotFoundException('Staff member not found');
    const [provider, departments] = await Promise.all([
      platformDb.provider.findFirst({ where: { tenantId, userId: member.userId } }),
      platformDb.department.findMany({ where: { tenantId } }),
    ]);
    const providerByUser = new Map(provider ? [[provider.userId, provider]] : []);
    const deptById = new Map(departments.map((d) => [d.id, d.name]));
    return this.mapStaff(member, providerByUser as any, deptById);
  }

  private mapStaff(m: any, providerByUser: Map<string, any>, deptById: Map<string, string>) {
    const provider = providerByUser.get(m.userId) ?? null;
    const roleDeptId = m.roles.find((r: any) => r.departmentId)?.departmentId ?? null;
    const departmentId = provider?.departmentId ?? roleDeptId;
    return {
      id: m.id,
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      phone: m.user.phone,
      roles: m.roles.map((r: any) => r.role.code),
      departmentId,
      departmentName: departmentId ? (deptById.get(departmentId) ?? null) : null,
      provider: provider
        ? {
            id: provider.id,
            type: provider.type,
            speciality: provider.speciality,
            registrationNumber: provider.registrationNumber,
            departmentId: provider.departmentId,
            active: provider.active,
          }
        : null,
      providerType: provider && provider.active ? provider.type : null,
      active: m.active,
      status: m.active ? 'ACTIVE' : 'INACTIVE',
      deactivatedAt: m.deactivatedAt,
      deactivationReason: m.deactivationReason,
      createdAt: m.createdAt,
    };
  }

  // ── Invite ────────────────────────────────────────────────────
  async invite(ctx: RequestContext, dto: InviteStaffDto) {
    const s = this.scope(ctx);
    const roles = [...new Set(dto.roles)];
    const needsProvider = roles.some((r) => PROVIDER_ROLES.has(r));
    if (needsProvider && !dto.departmentId) {
      throw new BadRequestException('A department is required when assigning a Doctor or Nurse role');
    }
    await this.assertDepartment(s.tenantId, dto.departmentId);

    const roleRecords = await platformDb.role.findMany({ where: { tenantId: s.tenantId, code: { in: roles } } });
    if (roleRecords.length !== roles.length) {
      throw new BadRequestException('One or more roles are not configured for this hospital');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await platformDb.user.findUnique({ where: { email } });
    if (existing?.isPlatform) {
      throw new BadRequestException('That email belongs to a platform user and cannot be added as staff');
    }
    if (existing) {
      const membership = await platformDb.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: s.tenantId, userId: existing.id } },
      });
      if (membership?.active) {
        throw new ConflictException('This person is already an active staff member of this hospital');
      }
    }

    const { uid } = await this.firebase.ensureUser(email, dto.fullName);

    const user = await platformDb.user.upsert({
      where: { email },
      update: {
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        firebaseUid: uid,
        isPlatform: false,
        disabledAt: null,
      },
      create: { email, fullName: dto.fullName, phone: dto.phone ?? null, firebaseUid: uid, isPlatform: false },
    });

    const membership = await platformDb.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: s.tenantId, userId: user.id } },
      update: { active: true, deactivatedAt: null, deactivationReason: null },
      create: { tenantId: s.tenantId, userId: user.id, active: true },
    });

    await this.replaceRoles(membership.id, roleRecords, dto.departmentId);
    await this.syncProvider(s.tenantId, user.id, roles, {
      departmentId: dto.departmentId,
      speciality: dto.speciality,
      registrationNumber: dto.registrationNumber,
    });

    await this.record(s, 'staff.invite', 'tenant_user', membership.id, {
      email,
      roles,
      providerType: this.providerType(roles),
    });
    return this.getById(ctx, membership.id);
  }

  private async replaceRoles(tenantUserId: string, roleRecords: { id: string }[], departmentId?: string | null) {
    await platformDb.userRole.deleteMany({ where: { tenantUserId } });
    if (roleRecords.length) {
      await platformDb.userRole.createMany({
        data: roleRecords.map((r) => ({ tenantUserId, roleId: r.id, departmentId: departmentId ?? null })),
        skipDuplicates: true,
      });
    }
  }

  /** Creates/updates the Provider for DOCTOR/NURSE; deactivates it for non-provider roles. */
  private async syncProvider(
    tenantId: string,
    userId: string,
    roles: string[],
    data: { departmentId?: string; speciality?: string; registrationNumber?: string },
  ) {
    const type = this.providerType(roles);
    if (type) {
      await platformDb.provider.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        update: {
          type: type as any,
          departmentId: data.departmentId ?? null,
          speciality: data.speciality ?? null,
          registrationNumber: data.registrationNumber ?? null,
          active: true,
        },
        create: {
          tenantId,
          userId,
          type: type as any,
          departmentId: data.departmentId ?? null,
          speciality: data.speciality ?? null,
          registrationNumber: data.registrationNumber ?? null,
          active: true,
        },
      });
    } else {
      // Non-provider roles must not have an active Provider (no hard delete).
      await platformDb.provider.updateMany({ where: { tenantId, userId }, data: { active: false } });
    }
  }

  // ── Update basic profile ──────────────────────────────────────
  async update(ctx: RequestContext, id: string, dto: UpdateStaffDto) {
    const s = this.scope(ctx);
    const member = await platformDb.tenantUser.findFirst({ where: { id, tenantId: s.tenantId } });
    if (!member) throw new NotFoundException('Staff member not found');
    await platformDb.user.update({
      where: { id: member.userId },
      data: { fullName: dto.fullName, phone: dto.phone },
    });
    await this.record(s, 'staff.update', 'tenant_user', id, { changes: dto });
    return this.getById(ctx, id);
  }

  // ── Update roles ──────────────────────────────────────────────
  async updateRoles(ctx: RequestContext, id: string, dto: UpdateRolesDto) {
    const s = this.scope(ctx);
    const member = await platformDb.tenantUser.findFirst({ where: { id, tenantId: s.tenantId } });
    if (!member) throw new NotFoundException('Staff member not found');

    const roles = [...new Set(dto.roles)];
    const needsProvider = roles.some((r) => PROVIDER_ROLES.has(r));
    if (needsProvider && !dto.departmentId) {
      throw new BadRequestException('A department is required when assigning a Doctor or Nurse role');
    }
    await this.assertDepartment(s.tenantId, dto.departmentId);

    const roleRecords = await platformDb.role.findMany({ where: { tenantId: s.tenantId, code: { in: roles } } });
    if (roleRecords.length !== roles.length) {
      throw new BadRequestException('One or more roles are not configured for this hospital');
    }

    await this.replaceRoles(member.id, roleRecords, dto.departmentId);
    await this.syncProvider(s.tenantId, member.userId, roles, { departmentId: dto.departmentId });

    await this.record(s, 'staff.roles.update', 'tenant_user', id, { roles, providerType: this.providerType(roles) });
    return this.getById(ctx, id);
  }

  // ── Deactivate / reactivate ───────────────────────────────────
  async deactivate(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const member = await platformDb.tenantUser.findFirst({
      where: { id, tenantId: s.tenantId },
      include: { roles: { include: { role: true } } },
    });
    if (!member) throw new NotFoundException('Staff member not found');
    if (member.userId === s.actorId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    // Never let the last active Hospital Admin be deactivated (lockout guard).
    const isAdmin = member.roles.some((r) => r.role.code === ROLES.HOSPITAL_ADMIN);
    if (isAdmin && member.active) {
      const activeAdmins = await platformDb.tenantUser.count({
        where: { tenantId: s.tenantId, active: true, roles: { some: { role: { code: ROLES.HOSPITAL_ADMIN } } } },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Cannot deactivate the last active Hospital Admin');
      }
    }

    await platformDb.tenantUser.update({
      where: { id },
      data: { active: false, deactivatedAt: new Date(), deactivationReason: reason },
    });
    await platformDb.provider.updateMany({
      where: { tenantId: s.tenantId, userId: member.userId },
      data: { active: false },
    });

    await this.record(s, 'staff.deactivate', 'tenant_user', id, { reason });
    return this.getById(ctx, id);
  }

  async reactivate(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const member = await platformDb.tenantUser.findFirst({ where: { id, tenantId: s.tenantId } });
    if (!member) throw new NotFoundException('Staff member not found');

    await platformDb.tenantUser.update({
      where: { id },
      data: { active: true, deactivatedAt: null, deactivationReason: null },
    });
    await platformDb.provider.updateMany({
      where: { tenantId: s.tenantId, userId: member.userId },
      data: { active: true },
    });

    await this.record(s, 'staff.reactivate', 'tenant_user', id, {});
    return this.getById(ctx, id);
  }

  // ── Password reset ────────────────────────────────────────────
  async resetPassword(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const member = await platformDb.tenantUser.findFirst({
      where: { id, tenantId: s.tenantId },
      include: { user: true },
    });
    if (!member) throw new NotFoundException('Staff member not found');

    const resetLink = await this.firebase.passwordResetLink(member.user.email);
    await this.record(s, 'staff.reset_password', 'tenant_user', id, { email: member.user.email });
    return { email: member.user.email, resetLink };
  }

  // ── Providers ─────────────────────────────────────────────────
  async listProviders(ctx: RequestContext) {
    const tenantId = this.scope(ctx).tenantId;
    const [providers, departments] = await Promise.all([
      platformDb.provider.findMany({ where: { tenantId }, include: { user: true }, orderBy: { createdAt: 'desc' } }),
      platformDb.department.findMany({ where: { tenantId } }),
    ]);
    const deptById = new Map(departments.map((d) => [d.id, d.name]));
    return providers.map((p) => this.mapProvider(p, deptById));
  }

  async myProvider(ctx: RequestContext) {
    const tenantId = this.scope(ctx).tenantId;
    const provider = await platformDb.provider.findFirst({
      where: { tenantId, userId: ctx.userId! },
      include: { user: true },
    });
    if (!provider) return null;
    const departments = await platformDb.department.findMany({ where: { tenantId } });
    return this.mapProvider(provider, new Map(departments.map((d) => [d.id, d.name])));
  }

  async getProvider(ctx: RequestContext, id: string) {
    const tenantId = this.scope(ctx).tenantId;
    const provider = await platformDb.provider.findFirst({ where: { id, tenantId }, include: { user: true } });
    if (!provider) throw new NotFoundException('Provider not found');
    const departments = await platformDb.department.findMany({ where: { tenantId } });
    return this.mapProvider(provider, new Map(departments.map((d) => [d.id, d.name])));
  }

  async updateProvider(ctx: RequestContext, id: string, dto: UpdateProviderDto) {
    const s = this.scope(ctx);
    const provider = await platformDb.provider.findFirst({ where: { id, tenantId: s.tenantId } });
    if (!provider) throw new NotFoundException('Provider not found');
    await this.assertDepartment(s.tenantId, dto.departmentId);
    await platformDb.provider.update({
      where: { id },
      data: {
        speciality: dto.speciality,
        registrationNumber: dto.registrationNumber,
        departmentId: dto.departmentId,
        active: dto.active,
      },
    });
    await this.record(s, 'provider.update', 'provider', id, { changes: dto });
    return this.getProvider(ctx, id);
  }

  private mapProvider(p: any, deptById: Map<string, string>) {
    return {
      id: p.id,
      userId: p.userId,
      fullName: p.user?.fullName ?? null,
      email: p.user?.email ?? null,
      type: p.type,
      speciality: p.speciality,
      registrationNumber: p.registrationNumber,
      departmentId: p.departmentId,
      departmentName: p.departmentId ? (deptById.get(p.departmentId) ?? null) : null,
      active: p.active,
    };
  }

  // ── Roles & permissions (read-only templates) ─────────────────
  async listRoles(ctx: RequestContext) {
    const tenantId = this.scope(ctx).tenantId;
    const roles = await platformDb.role.findMany({
      where: { tenantId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      systemRole: r.systemRole,
      landing: ROLE_LANDING[r.code as RoleCode] ?? null,
      memberCount: r._count.userRoles,
      permissions: r.permissions.map((rp) => rp.permission.key),
    }));
  }

  async getRole(ctx: RequestContext, id: string) {
    const tenantId = this.scope(ctx).tenantId;
    const role = await platformDb.role.findFirst({
      where: { id, tenantId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      systemRole: role.systemRole,
      landing: ROLE_LANDING[role.code as RoleCode] ?? null,
      permissions: role.permissions.map((rp) => rp.permission.key),
    };
  }

  async listPermissions() {
    const perms = await platformDb.permission.findMany({ orderBy: { key: 'asc' } });
    return perms
      .filter((p) => !p.key.startsWith('platform.'))
      .map((p) => ({ key: p.key, description: p.description, group: p.key.split('.')[0] }));
  }
}
