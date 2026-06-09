// Canonical route maps (documentation contract). Kept in sync with
// PROJECT_IMPLEMENTATION_PLAN.md and NEW_APP_PRODUCT_SPEC.md.

export const PUBLIC_ROUTES = ['/login', '/forgot-password'] as const;

export const PLATFORM_ROUTES = ['/platform', '/platform/tenants/[id]', '/platform/plans', '/platform/audit'] as const;

export const TENANT_ROUTES = [
  '/admin',
  '/admin/profile',
  '/admin/facilities',
  '/admin/departments',
  '/admin/staff',
  '/admin/roles',
  '/admin/catalog',
  '/admin/wards',
  '/admin/lab-catalog',
  '/admin/insurance',
  '/patients',
  '/patients/[id]',
  '/reception',
  '/opd',
  '/opd/appointments',
  '/doctor',
  '/doctor/consult/[encounterId]',
  '/nursing',
  '/nursing/ipd/[admissionId]',
  '/lab',
  '/lab/orders/[id]',
  '/lab/reports/[id]',
  '/pharmacy',
  '/pharmacy/dispense/[id]',
  '/inventory',
  '/inventory/items',
  '/inventory/purchases',
  '/inventory/suppliers',
  '/inventory/transactions',
  '/billing',
  '/billing/new',
  '/billing/[id]',
  '/billing/[id]/invoice',
  '/accounts',
  '/insurance',
  '/insurance/claims/[id]',
  '/ipd',
  '/ipd/admit',
  '/ipd/admissions/[id]',
  '/ipd/admissions/[id]/discharge',
  '/ipd/admissions/[id]/summary',
  '/reports',
  '/reports/operations',
  '/reports/financial',
  '/reports/inventory',
  '/reports/clinical',
  '/manager',
] as const;

export const ERROR_ROUTES = ['/unauthorized', '/module-disabled', '/tenant-suspended'] as const;

/** Platform API surface (Phase 4 — implemented). */
export const PLATFORM_API_ROUTES = {
  listTenants: 'GET /platform/tenants',
  createTenant: 'POST /platform/tenants',
  getTenant: 'GET /platform/tenants/:id',
  suspendTenant: 'POST /platform/tenants/:id/suspend',
  activateTenant: 'POST /platform/tenants/:id/activate',
  listModules: 'GET /platform/tenants/:id/modules',
  setModule: 'POST /platform/tenants/:id/modules',
  inviteAdmin: 'POST /platform/tenants/:id/invite-admin',
  audit: 'GET /platform/audit',
  plans: 'GET /platform/plans',
} as const;
