'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import Protected from '@/components/Protected';
import { PageHeader, Spinner, ErrorState, Badge, Card } from '@/components/ui';
import { platformApi, type Plan } from '@/lib/platform';
import { MODULE_CODES } from '@/lib/constants';

function inr(minor: number): string {
  if (!minor) return 'Custom';
  return '₹' + (minor / 100).toLocaleString('en-IN');
}

function PlansInner() {
  const [rows, setRows] = useState<Plan[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    platformApi
      .listPlans()
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <PageHeader title="Subscription Plans" subtitle="Module bundles offered to hospitals." />
      {err && <ErrorState message={err} />}
      {!err && rows === null && <Spinner />}
      {rows && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {rows.map((p) => {
            const set = new Set(p.modules);
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="text-label-md uppercase text-primary-700">{p.code}</div>
                <div className="mt-1 text-headline-md text-ink">{inr(p.priceInr)}</div>
                <div className="text-body-sm text-ink-soft">{p.priceInr ? 'per month' : 'quote-led'}</div>
                <div className="mt-3 text-body-sm text-ink-muted">Users: {p.userLimit ?? 'Unlimited'}</div>
                <div className="mt-4 space-y-1.5 border-t border-line pt-4">
                  {MODULE_CODES.map((m) => (
                    <div
                      key={m}
                      className={
                        set.has(m)
                          ? 'flex items-center gap-2 text-body-sm text-ink'
                          : 'flex items-center gap-2 text-body-sm text-ink-soft/50'
                      }
                    >
                      <Check className={set.has(m) ? 'h-3.5 w-3.5 text-success' : 'h-3.5 w-3.5 text-slate-300'} />
                      {m}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function PlansPage() {
  return (
    <Protected requirePlatform>
      <PlansInner />
    </Protected>
  );
}
