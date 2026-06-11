'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Phone, Globe, Stethoscope, Clock } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { publicApi, inr, type PublicHospital, type PublicDoctor, type PublicAppointmentType } from '@/lib/public';

export default function HospitalProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ hospital: PublicHospital; doctors: PublicDoctor[]; appointmentTypes: PublicAppointmentType[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    publicApi.hospital(slug).then(setData).catch((e) => setErr((e as Error).message));
  }, [slug]);

  if (err) {
    return (
      <PublicShell>
        <BackLink />
        <div className="rounded-lg border border-line bg-surface px-6 py-12 text-center text-body-sm text-ink-muted">{err}</div>
      </PublicShell>
    );
  }
  if (!data) {
    return (
      <PublicShell>
        <p className="py-10 text-center text-body-sm text-ink-soft">Loading…</p>
      </PublicShell>
    );
  }

  const h = data.hospital;
  return (
    <PublicShell>
      <BackLink />
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="h-28 bg-gradient-to-r from-primary-100 to-primary-50" />
        <div className="px-6 pb-6">
          <div className="-mt-8 mb-3 grid h-16 w-16 place-items-center rounded-xl border border-line bg-surface text-primary-700">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-display-sm font-semibold text-ink">{h.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-ink-muted">
            {(h.address || h.city) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {[h.address, h.city, h.state].filter(Boolean).join(', ')}
              </span>
            )}
            {h.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-4 w-4" /> {h.phone}
              </span>
            )}
            {h.website && (
              <a href={h.website} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
          </div>
          {h.description && <p className="mt-4 max-w-2xl text-body-md text-ink-muted">{h.description}</p>}

          <Chips title="Specialties" items={h.specialties} />
          <Chips title="Services" items={h.services} />
          <Chips title="Facilities" items={h.facilities} />
        </div>
      </div>

      {data.appointmentTypes.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-title-lg font-semibold text-ink">Appointment types</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.appointmentTypes.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="font-medium text-ink">{t.name}</div>
                <div className="mt-1 flex items-center gap-3 text-body-sm text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {t.durationMinutes} min
                  </span>
                  <span className="font-medium text-ink">{inr(t.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-title-lg font-semibold text-ink">Doctors</h2>
        {data.doctors.length === 0 ? (
          <p className="text-body-sm text-ink-soft">No public doctor profiles yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.doctors.map((d) => (
              <Link key={d.doctorId} href={`/doctors/${d.slug}`} className="group flex gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-primary">
                <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-primary-100 text-primary-700">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-ink group-hover:text-primary">{d.name}</div>
                  <div className="text-body-sm text-ink-muted">{d.specialty}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}

function BackLink() {
  return (
    <Link href="/hospitals" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> All hospitals
    </Link>
  );
}

function Chips({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-label-md uppercase text-ink-soft">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span key={s} className="rounded-full bg-canvas px-2.5 py-1 text-label-sm text-ink-muted">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
