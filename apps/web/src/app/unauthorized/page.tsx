'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useAuth, landingPath } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import { Button } from '@/components/ui';

export default function UnauthorizedPage() {
  const { profile, loading, activeTenantId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profile) router.replace('/login');
  }, [loading, profile, router]);

  if (loading || !profile) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-body-sm text-ink-soft">Loading…</div>;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <div className="card p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-warning-bg text-warning-fg">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-headline-md text-ink">Access restricted</h1>
          <p className="mx-auto mt-1 max-w-sm text-body-md text-ink-muted">
            You don&apos;t have the role or permission required to view that page. If you believe this is a mistake,
            contact your hospital administrator.
          </p>
          <div className="mt-6">
            <Link href={landingPath(profile, activeTenantId)}>
              <Button>Back to my dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
