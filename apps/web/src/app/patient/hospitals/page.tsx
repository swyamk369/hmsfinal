'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Plus, MapPin, CheckCircle2 } from 'lucide-react';
import { usePortal } from '@/components/patient/portal-shell';
import { EmptyState } from '@/components/patient/portal-ui';
import { Avatar } from '@/components/patient/directory-ui';

export default function HospitalsPage() {
  const router = useRouter();
  const { hospitals, tenantId, setTenantId, openLinkModal } = usePortal();

  function openPortal(id: string) {
    setTenantId(id);
    router.push('/patient/dashboard');
  }

  if (hospitals.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No hospital records linked yet"
        body="Link a hospital where you already have records, or book a new appointment to create one."
        action={
          <div className="flex gap-2">
            <button
              onClick={openLinkModal}
              className="rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-canvas"
            >
              Link a record
            </button>
            <Link href="/doctors" className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">
              Find a doctor
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <div>
      <p className="mb-4 text-body-md text-ink-muted">Choose which hospital's records to view, or link another.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {hospitals.map((h) => {
          const active = h.tenantId === tenantId;
          return (
            <div
              key={h.tenantId}
              className={`rounded-xl border bg-surface p-5 ${active ? 'border-primary ring-1 ring-primary-100' : 'border-line'}`}
            >
              <div className="flex items-start gap-3">
                <Avatar name={h.hospitalName} url={h.logoUrl} shape="square" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-ink">{h.hospitalName}</h3>
                    {active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-label-sm font-medium text-success-fg">
                        <CheckCircle2 className="h-3 w-3" /> Viewing
                      </span>
                    )}
                  </div>
                  {h.city && (
                    <div className="mt-0.5 flex items-center gap-1 text-body-sm text-ink-soft">
                      <MapPin className="h-3.5 w-3.5" /> {h.city}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => openPortal(h.tenantId)}
                disabled={active}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:cursor-default disabled:opacity-50"
              >
                {active ? 'Currently open' : 'Open Portal'}
              </button>
            </div>
          );
        })}

        <button
          onClick={openLinkModal}
          className="flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-canvas p-5 text-ink-muted hover:border-primary hover:text-primary"
        >
          <Plus className="h-6 w-6" />
          <span className="font-medium">Link another hospital record</span>
        </button>
      </div>
    </div>
  );
}
