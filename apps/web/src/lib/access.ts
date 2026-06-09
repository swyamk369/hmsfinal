// Pure, framework-free access + navigation logic. No React / Firebase imports,
// so it is directly unit-testable and safe to import anywhere.

import { NAV, PLATFORM_NAV, ROLE_LANDING, type NavItem } from './constants';
import type { Membership, Profile } from './types';

/** Returns the membership for the active tenant, falling back to the first. */
export function getActiveMembership(profile: Profile | null, activeTenantId: string | null): Membership | null {
  if (!profile || profile.tenants.length === 0) return null;
  return profile.tenants.find((t) => t.tenantId === activeTenantId) ?? profile.tenants[0];
}

/** The route a user should land on after login, based on platform status / first role. */
export function landingPath(profile: Profile | null, activeTenantId: string | null): string {
  if (!profile) return '/login';
  if (profile.isPlatform) return '/platform';
  const membership = getActiveMembership(profile, activeTenantId);
  const role = membership?.roles[0];
  return (role && ROLE_LANDING[role]) || '/dashboard';
}

/** Navigation items visible for the given user + active tenant. */
export function visibleNav(profile: Profile | null, activeMembership: Membership | null): NavItem[] {
  if (!profile) return [];
  if (profile.isPlatform) return PLATFORM_NAV;

  const modules = new Set(activeMembership?.modules ?? []);
  const roles = new Set(activeMembership?.roles ?? []);
  const permissions = new Set(activeMembership?.permissions ?? []);

  return NAV.filter((item) => {
    if (item.module && !modules.has(item.module)) return false;
    if (item.roles?.length && !item.roles.some((r) => roles.has(r))) return false;
    if (item.permission?.length && !item.permission.some((p) => permissions.has(p))) return false;
    return true;
  });
}

export interface AccessRequirement {
  allowedRoles?: string[];
  requireModule?: string;
  requirePlatform?: boolean;
  requirePermission?: string[];
}

/**
 * The single source of truth for route gating. Returns the path to redirect to,
 * or null when access is allowed. `null` profile means not signed in.
 */
export function routeDecision(
  profile: Profile | null,
  activeMembership: Membership | null,
  req: AccessRequirement = {},
): string | null {
  if (!profile) return '/login';

  const suspended = !profile.isPlatform && activeMembership?.status === 'SUSPENDED';
  if (suspended) return '/tenant-suspended';

  if (req.requirePlatform && !profile.isPlatform) return '/unauthorized';

  if (!profile.isPlatform) {
    if (profile.tenants.length === 0) return '/unauthorized';

    const roles = new Set(activeMembership?.roles ?? []);
    const modules = new Set(activeMembership?.modules ?? []);
    const permissions = new Set(activeMembership?.permissions ?? []);

    if (req.allowedRoles?.length && !req.allowedRoles.some((r) => roles.has(r))) return '/unauthorized';
    if (req.requireModule && !modules.has(req.requireModule)) return `/module-disabled?module=${req.requireModule}`;
    if (req.requirePermission?.length && !req.requirePermission.some((p) => permissions.has(p))) return '/unauthorized';
  }

  return null;
}

/**
 * Breadcrumb trail from a pathname using a segment→label map. Cumulative hrefs
 * let each crumb (except the last) be a working link.
 */
export function breadcrumbs(pathname: string, labels: Record<string, string>): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    // Skip opaque dynamic ids (uuids / long hex) — show a generic "Detail" label.
    const isId = /^[0-9a-f-]{16,}$/i.test(seg);
    crumbs.push({ label: isId ? 'Detail' : (labels[seg] ?? titleCase(seg)), href: acc });
  }
  return crumbs;
}

function titleCase(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
