'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { routeDecision } from '@/lib/access';
import AppShell from './app-shell';

interface ProtectedProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireModule?: string;
  requirePlatform?: boolean;
  /** With requirePlatform: also admit platform support staff (isSupport). */
  allowSupport?: boolean;
  requirePermission?: string[];
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-canvas text-body-sm text-ink-soft">{children}</div>;
}

/**
 * Loading screen that can never hang silently: a spinner first, and after a few
 * seconds a "still working" notice with a retry action. Auth failures (API down,
 * timeout, 5xx on /auth/me) render an explicit error card instead of a blank page.
 */
function LoadingScreen({ onRetry }: { onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <FullScreen>
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span>Loading your workspace…</span>
        {slow ? (
          <div className="mt-2 flex flex-col items-center gap-2">
            <span className="text-ink-muted">This is taking longer than usual. The server may be starting up.</span>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-body-sm font-medium text-ink hover:bg-surface-muted"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : null}
      </div>
    </FullScreen>
  );
}

function AuthErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <FullScreen>
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="text-body-md font-semibold text-ink">Can’t reach the hospital system</span>
        <span className="text-ink-muted">{message}</span>
        <div className="mt-1 flex gap-2">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-body-sm font-medium text-white hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <a
            href="/login"
            className="inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 text-body-sm font-medium text-ink hover:bg-surface-muted"
          >
            Go to sign in
          </a>
        </div>
      </div>
    </FullScreen>
  );
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
  allowSupport,
  requirePermission,
}: ProtectedProps) {
  const { profile, loading, error, activeMembership, refresh } = useAuth();
  const router = useRouter();

  const redirect =
    !loading && profile
      ? routeDecision(profile, activeMembership, {
          allowedRoles,
          requireModule,
          requirePlatform,
          allowSupport,
          requirePermission,
        })
      : null;

  useEffect(() => {
    if (loading) return;
    // Only bounce to /login when the user is genuinely signed out — an API
    // outage (error set) must show the retry screen, not a login loop.
    if (!profile && !error) router.replace('/login');
    else if (profile && redirect) router.replace(redirect);
  }, [loading, profile, error, redirect, router]);

  if (loading) return <LoadingScreen onRetry={() => void refresh()} />;
  if (!profile && error) return <AuthErrorScreen message={error} onRetry={() => void refresh()} />;
  if (!profile) return <FullScreen>Redirecting to sign in…</FullScreen>;
  if (redirect) return <FullScreen>Redirecting…</FullScreen>;

  return <AppShell>{children}</AppShell>;
}
