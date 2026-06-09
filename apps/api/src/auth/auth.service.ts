import { Injectable, NotFoundException } from '@nestjs/common';
import { platformDb } from '@hms/db';
import { AccessService } from '../common/access.service';

export interface TenantMembership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  roles: string[];
  permissions: string[];
  modules: string[];
  providerId: string | null;
}

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  isPlatform: boolean;
  tenants: TenantMembership[];
}

@Injectable()
export class AuthService {
  constructor(private readonly access: AccessService) {}

  async me(userId: string): Promise<MeResponse> {
    const user = await platformDb.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const tenants: TenantMembership[] = [];
    for (const m of user.memberships) {
      if (!m.active) continue;
      const a = await this.access.resolveActive(userId, m.tenantId);
      if (!a.tenantName) continue;
      tenants.push({
        tenantId: m.tenantId,
        tenantName: a.tenantName,
        tenantSlug: a.tenantSlug ?? '',
        status: a.tenantStatus ?? 'UNKNOWN',
        roles: a.roles,
        permissions: a.permissions,
        modules: a.modules,
        providerId: a.providerId,
      });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatform: user.isPlatform,
      tenants,
    };
  }
}
