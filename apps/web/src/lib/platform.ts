import { apiGet, apiPost } from './api';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  contactEmail: string | null;
  staffCount: number;
  moduleCount: number;
  subscriptionStatus: string | null;
  createdAt: string;
}

export interface ModuleEntitlement {
  id: string;
  tenantId: string;
  moduleCode: string;
  enabled: boolean;
  source: string;
}

export interface TenantAdmin {
  userId: string;
  email: string;
  fullName: string;
  active: boolean;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  priceInr: number;
  priceUsd: number;
  userLimit: number | null;
  modules: string[];
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  modules: ModuleEntitlement[];
  subscription: { status: string; currentPeriodEnd: string | null } | null;
  plan: Plan | null;
  staffCount: number;
  admins: TenantAdmin[];
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  planCode: string;
  contactEmail?: string;
}

export interface InviteAdminInput {
  email: string;
  fullName: string;
  password: string;
}

export const platformApi = {
  listTenants: () => apiGet<TenantRow[]>('/platform/tenants'),
  getTenant: (id: string) => apiGet<TenantDetail>(`/platform/tenants/${id}`),
  createTenant: (dto: CreateTenantInput) => apiPost<TenantDetail>('/platform/tenants', dto),
  suspend: (id: string, reason: string) => apiPost(`/platform/tenants/${id}/suspend`, { reason }),
  activate: (id: string) => apiPost(`/platform/tenants/${id}/activate`, {}),
  setModule: (id: string, moduleCode: string, enabled: boolean) =>
    apiPost(`/platform/tenants/${id}/modules`, { moduleCode, enabled }),
  inviteAdmin: (id: string, dto: InviteAdminInput) => apiPost(`/platform/tenants/${id}/invite-admin`, dto),
  listPlans: () => apiGet<Plan[]>('/platform/plans'),
  listAudit: () => apiGet<AuditRow[]>('/platform/audit'),
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
