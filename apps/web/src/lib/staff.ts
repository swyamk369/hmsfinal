import { apiGet, apiPost, apiPatch } from './api';

export interface ProviderProfile {
  id: string;
  type: 'DOCTOR' | 'NURSE' | 'OTHER';
  speciality: string | null;
  registrationNumber: string | null;
  departmentId: string | null;
  active: boolean;
}

export interface StaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roles: string[];
  departmentId: string | null;
  departmentName: string | null;
  provider: ProviderProfile | null;
  providerType: 'DOCTOR' | 'NURSE' | 'OTHER' | null;
  active: boolean;
  status: string;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  createdAt: string;
}

export interface ProviderRow {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  type: 'DOCTOR' | 'NURSE' | 'OTHER';
  speciality: string | null;
  registrationNumber: string | null;
  departmentId: string | null;
  departmentName: string | null;
  active: boolean;
}

export interface RoleTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  systemRole: boolean;
  landing: string | null;
  memberCount: number;
  permissions: string[];
}

export interface PermissionRow {
  key: string;
  description: string | null;
  group: string;
}

export interface InviteStaffInput {
  fullName: string;
  email: string;
  phone?: string;
  roles: string[];
  departmentId?: string;
  speciality?: string;
  registrationNumber?: string;
}

export interface ResetPasswordResult {
  email: string;
  resetLink: string;
}

export const staffApi = {
  list: (t: string) => apiGet<StaffMember[]>('/staff', t),
  get: (t: string, id: string) => apiGet<StaffMember>(`/staff/${id}`, t),
  invite: (t: string, body: InviteStaffInput) => apiPost<StaffMember>('/staff', body, t),
  update: (t: string, id: string, body: { fullName?: string; phone?: string }) =>
    apiPatch<StaffMember>(`/staff/${id}`, body, t),
  updateRoles: (t: string, id: string, body: { roles: string[]; departmentId?: string }) =>
    apiPatch<StaffMember>(`/staff/${id}/roles`, body, t),
  deactivate: (t: string, id: string, reason: string) => apiPost<StaffMember>(`/staff/${id}/deactivate`, { reason }, t),
  reactivate: (t: string, id: string) => apiPost<StaffMember>(`/staff/${id}/reactivate`, {}, t),
  resetPassword: (t: string, id: string) => apiPost<ResetPasswordResult>(`/staff/${id}/reset-password`, {}, t),

  listProviders: (t: string) => apiGet<ProviderRow[]>('/providers', t),
  myProvider: (t: string) => apiGet<ProviderRow | null>('/providers/me', t),
  updateProvider: (
    t: string,
    id: string,
    body: { speciality?: string; registrationNumber?: string; departmentId?: string; active?: boolean },
  ) => apiPatch<ProviderRow>(`/providers/${id}`, body, t),

  listRoles: (t: string) => apiGet<RoleTemplate[]>('/roles', t),
  getRole: (t: string, id: string) => apiGet<RoleTemplate>(`/roles/${id}`, t),
  listPermissions: (t: string) => apiGet<PermissionRow[]>('/permissions', t),
};

/** Roles that create a Provider record (require a department). */
export const PROVIDER_ROLE_CODES = ['DOCTOR', 'NURSE'];

export function rolesNeedProvider(roles: string[]): boolean {
  return roles.some((r) => PROVIDER_ROLE_CODES.includes(r));
}
