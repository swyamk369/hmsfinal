'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Stethoscope, Building2, MapPin, Video, Languages, GraduationCap, Clock, CalendarCheck, Phone } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { publicApi, inr, type PublicDoctor, type PublicHospital, type PublicAppointmentType } from '@/lib/public';

export default function DoctorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ doctor: PublicDoctor; hospital: PublicHospital | null; appointmentTypes: PublicAppointmentType[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    publicApi.doctor(slug).then(setData).catch((e) => setErr((e as Error).message));
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

  const { doctor: d, hospital: h } = data;
  return (
    <PublicShell>
      <BackLink />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="flex gap-4">
              <div className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-full bg-primary-100 text-primary-700">
                <Stethoscope className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-display-sm font-semibold text-ink">{d.name}</h1>
                {d.specialty && <div className="text-body-md text-primary">{d.specialty}</div>}
                {d.qualifications && (
                  <div className="mt-1 flex items-center gap-1 text-body-sm text-ink-muted">
                    <GraduationCap className="h-4 w-4" /> {d.qualifications}
                  </div>
                )}
                {h && (
                  <Link href={`/hospitals/${h.slug}`} className="mt-1 inline-flex items-center gap-1 text-body-sm text-ink-muted hover:text-primary">
                    <Building2 className="h-4 w-4" /> {h.name}
                    {h.city && (
                      <>
                        <MapPin className="ml-2 h-3.5 w-3.5" /> {h.city}
                      </>
                    )}
                  </Link>
                )}
              </div>
            </div>

            {d.bio && <p className="mt-5 text-body-md text-ink-muted">{d.bio}</p>}

            <div className="mt-5 flex flex-wrap gap-4 text-body-sm text-ink-muted">
              {d.languages?.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Languages className="h-4 w-4" /> {d.languages.join(', ')}
                </span>
              )}
              {d.telehealthAvailable && (
                <span className="inline-flex items-center gap-1">
                  <Video className="h-4 w-4" /> Telehealth available
                </span>
              )}
              {d.acceptsNewPatients && <span className="text-success-fg">Accepting new patients</span>}
            </div>

            {d.services?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {d.services.map((s) => (
                  <span key={s} className="rounded-full bg-canvas px-2.5 py-1 text-label-sm text-ink-muted">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {data.appointmentTypes.length > 0 && (
            <div className="mt-6 rounded-xl border border-line bg-surface p-6">
              <h2 className="mb-3 text-title-lg font-semibold text-ink">Appointment types</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.appointmentTypes.map((t) => (
                  <div key={t.id} className="rounded-lg border border-line p-4">
                    <div className="font-medium text-ink">{t.name}</div>
                    {t.description && <div className="mt-0.5 text-body-sm text-ink-muted">{t.description}</div>}
                    <div className="mt-2 flex items-center gap-3 text-body-sm">
                      <span className="inline-flex items-center gap-1 text-ink-muted">
                        <Clock className="h-3.5 w-3.5" /> {t.durationMinutes} min
                      </span>
                      <span className="font-semibold text-ink">{inr(t.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Booking sidebar */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="mb-1 text-title-lg font-semibold text-ink">Book an appointment</div>
            <p className="text-body-sm text-ink-muted">
              {d.bookingEnabled ? 'Choose a time that works for you.' : 'This doctor is not accepting online bookings right now.'}
            </p>
            {d.bookingEnabled ? (
              <Link
                href={`/book/${d.tenantId}/${d.doctorId}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90"
              >
                <CalendarCheck className="h-4 w-4" /> Book appointment
              </Link>
            ) : (
              <div className="mt-4 rounded-lg border border-line bg-canvas p-3 text-body-sm text-ink-muted">
                Online booking isn&apos;t available for this doctor right now.
                {h?.phone && (
                  <>
                    {' '}
                    Call{' '}
                    <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1 font-medium text-primary">
                      <Phone className="h-3.5 w-3.5" /> {h.phone}
                    </a>
                    .
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function BackLink() {
  return (
    <Link href="/doctors" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> All doctors
    </Link>
  );
}
