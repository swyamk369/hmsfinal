'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { routeDecision } from '@/lib/access';
import AppShell from './app-shell';

interface ProtectedProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireModule?: string;
  requirePlatform?: boolean;
  requirePermission?: string[];
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-canvas text-body-sm text-ink-soft">{children}</div>;
}

/**
 * Gates a page on authentication, then platform status, tenant status, role,
 * module entitlement, and (optionally) permission. The decision is computed by
 * the pure `routeDecision` so it can be unit-tested. Denials route to dedicated,
 * reachable state pages: /tenant-suspended, /unauthorized, /module-disabled.
 */
export default function Protected({
  children,
  allowedRoles,
  requireModule,
  requirePlatform,
  requirePermission,
}: ProtectedProps) {
  const { profile, loading, activeMembership } = useAuth();
  const router = useRouter();

  const redirect =
    !loading && profile
      ? routeDecision(profile, activeMembership, { allowedRoles, requireModule, requirePlatform, requirePermission })
      : null;

  useEffect(() => {
    if (loading) return;
    if (!profile) router.replace('/login');
    else if (redirect) router.replace(redirect);
  }, [loading, profile, redirect, router]);

  if (loading) return <FullScreen>Loading…</FullScreen>;
  if (!profile) return <FullScreen>Redirecting to sign in…</FullScreen>;
  if (redirect) return <FullScreen>Redirecting…</FullScreen>;

  return <AppShell>{children}</AppShell>;
}
