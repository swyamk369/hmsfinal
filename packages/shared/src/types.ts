// Shared API contract types used by both the web client and (optionally) the API.

export interface Membership {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  roles: string[];
  permissions: string[];
  modules: string[];
  providerId: string | null;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  isPlatform: boolean;
  tenants: Membership[];
}
