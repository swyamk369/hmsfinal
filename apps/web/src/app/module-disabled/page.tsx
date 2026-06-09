'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PackageX } from 'lucide-react';
import { useAuth, landingPath } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import { Button } from '@/components/ui';
import { MODULE_LABELS } from '@/lib/constants';

function ModuleDisabledInner() {
  const { profile, loading, activeTenantId } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const moduleCode = params.get('module') ?? '';

  useEffect(() => {
    if (!loading && !profile) router.replace('/login');
  }, [loading, profile, router]);

  if (loading || !profile) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-body-sm text-ink-soft">Loading…</div>;
  }

  const label = MODULE_LABELS[moduleCode] ?? moduleCode;

  return (
    <AppShell>
      <div className="mx-auto max-w-lg">
        <div className="card p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-warning-bg text-warning-fg">
            <PackageX className="h-6 w-6" />
          </div>
          <h1 className="text-headline-md text-ink">Module not enabled</h1>
          <p className="mx-auto mt-1 max-w-sm text-body-md text-ink-muted">
            {label ? (
              <>
                The <span className="font-semibold text-ink">{label}</span> module
              </>
            ) : (
              'This module'
            )}{' '}
            is not enabled on your hospital&apos;s plan. Ask your administrator to enable it or upgrade the plan.
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

export default function ModuleDisabledPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-canvas text-body-sm text-ink-soft">Loading…</div>
      }
    >
      <ModuleDisabledInner />
    </Suspense>
  );
}
