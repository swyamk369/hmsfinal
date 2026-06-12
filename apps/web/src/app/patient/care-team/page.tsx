'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Building2, Trash2, CalendarPlus } from 'lucide-react';
import { portalApi, type SavedProvider, type SavedHospital } from '@/lib/patient-portal';
import { Loading, EmptyState, ErrorState } from '@/components/patient/portal-ui';
import { Avatar } from '@/components/patient/directory-ui';

export default function CareTeamPage() {
  const [providers, setProviders] = useState<SavedProvider[] | null>(null);
  const [hospitals, setHospitals] = useState<SavedHospital[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [p, h] = await Promise.all([portalApi.savedProviders(), portalApi.savedHospitals()]);
      setProviders(p);
      setHospitals(h);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeProvider(id: string) {
    await portalApi.removeSavedProvider(id).catch(() => {});
    await load();
  }
  async function removeHospital(id: string) {
    await portalApi.removeSavedHospital(id).catch(() => {});
    await load();
  }

  if (err) return <ErrorState msg={err} />;
  if (!providers || !hospitals) return <Loading label="Loading your care team…" />;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-headline-md text-ink">Care Team</h1>
        <p className="text-body-sm text-ink-muted">Your saved doctors and hospitals for quick re-booking.</p>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-headline-sm text-ink">
          <Heart className="h-5 w-5 text-primary" /> Saved doctors
        </h2>
        {providers.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No saved doctors yet"
            body="Tap the heart on a doctor’s profile to save them here."
            action={
              <Link
                href="/doctors"
                className="rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-white hover:bg-primary-700"
              >
                Find a doctor
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <Avatar name={p.doctorName} url={p.photoUrl} shape="circle" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{p.doctorName}</p>
                  {p.specialty && <p className="text-body-sm text-ink-muted">{p.specialty}</p>}
                  <p className="truncate text-label-sm text-ink-soft">{p.hospitalName}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Link
                      href={`/book/${p.tenantId}/${p.doctorId}`}
                      className="inline-flex items-center gap-1 text-label-md font-medium text-primary hover:underline"
                    >
                      <CalendarPlus className="h-4 w-4" /> Book again
                    </Link>
                    {p.doctorSlug && (
                      <Link href={`/doctors/${p.doctorSlug}`} className="text-label-md text-ink-muted hover:text-ink">
                        View profile
                      </Link>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeProvider(p.id)}
                  aria-label="Remove"
                  className="text-ink-soft hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-headline-sm text-ink">
          <Building2 className="h-5 w-5 text-primary" /> Saved hospitals
        </h2>
        {hospitals.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No saved hospitals yet"
            body="Save a hospital from its profile to find it quickly later."
            action={
              <Link
                href="/hospitals"
                className="rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-white hover:bg-primary-700"
              >
                Browse hospitals
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {hospitals.map((h) => (
              <div key={h.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                <Avatar name={h.hospitalName} url={h.logoUrl} shape="square" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{h.hospitalName}</p>
                  {h.city && <p className="text-body-sm text-ink-muted">{h.city}</p>}
                  {h.hospitalSlug && (
                    <Link
                      href={`/hospitals/${h.hospitalSlug}`}
                      className="mt-2 inline-block text-label-md font-medium text-primary hover:underline"
                    >
                      View details
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => removeHospital(h.id)}
                  aria-label="Remove"
                  className="text-ink-soft hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
