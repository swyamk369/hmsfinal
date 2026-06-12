'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Video,
  User,
  Languages,
  GraduationCap,
  Clock,
  CalendarCheck,
  Phone,
  BadgeCheck,
  Stethoscope,
} from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { Avatar, Tag } from '@/components/patient/directory-ui';
import { SaveDoctorButton } from '@/components/patient/save-button';
import {
  publicApi,
  inr,
  type PublicDoctor,
  type PublicHospital,
  type PublicAppointmentType,
  type DaySlots,
} from '@/lib/public';

function DoctorProfileInner() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{
    doctor: PublicDoctor;
    hospital: PublicHospital | null;
    appointmentTypes: PublicAppointmentType[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    publicApi
      .doctor(slug)
      .then(setData)
      .catch((e) => setErr((e as Error).message));
  }, [slug]);

  if (err) {
    return (
      <PublicShell>
        <BackLink />
        <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center text-body-md text-ink-muted">
          {err}
        </div>
      </PublicShell>
    );
  }
  if (!data) {
    return (
      <PublicShell>
        <BackLink />
        <p className="py-10 text-center text-body-sm text-ink-soft">Loading…</p>
      </PublicShell>
    );
  }

  const { doctor: d, hospital: h } = data;
  return (
    <PublicShell>
      <BackLink />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <section className="rounded-xl border border-line bg-surface p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Avatar name={d.name} url={d.photoUrl} size="lg" />
              <div className="min-w-0 flex-grow">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-headline-md font-semibold text-ink">{d.name}</h1>
                  <SaveDoctorButton
                    tenantId={d.tenantId}
                    doctorId={d.doctorId}
                    doctorSlug={d.slug}
                    doctorName={d.name}
                    specialty={d.specialty}
                    hospitalName={h?.name ?? ''}
                    photoUrl={d.photoUrl}
                    className="-mr-1.5 -mt-1.5 flex-shrink-0"
                  />
                </div>
                {d.specialty && <div className="text-body-lg font-medium text-primary">{d.specialty}</div>}
                {d.qualifications && (
                  <div className="mt-1 flex items-center gap-1.5 text-body-sm text-ink-muted">
                    <GraduationCap className="h-4 w-4 flex-shrink-0" /> {d.qualifications}
                  </div>
                )}
                {h && (
                  <Link
                    href={`/hospitals/${h.slug}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-body-sm text-ink-muted hover:text-primary"
                  >
                    <Building2 className="h-4 w-4 flex-shrink-0" /> {h.name}
                    {h.city && (
                      <>
                        <MapPin className="ml-1.5 h-3.5 w-3.5" /> {h.city}
                      </>
                    )}
                  </Link>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(d.consultationTypes ?? []).includes('IN_PERSON') && (
                    <Tag>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" /> In-person
                      </span>
                    </Tag>
                  )}
                  {d.telehealthAvailable && (
                    <Tag>
                      <span className="inline-flex items-center gap-1">
                        <Video className="h-3 w-3" /> Telehealth
                      </span>
                    </Tag>
                  )}
                  {d.acceptsNewPatients && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-label-sm font-medium text-success-fg">
                      <BadgeCheck className="h-3.5 w-3.5" /> Accepting new patients
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {d.bio && (
            <Section title="About">
              <p className="text-body-md leading-relaxed text-ink-muted">{d.bio}</p>
            </Section>
          )}

          {(d.qualifications || d.registrationNumber || (d.subSpecialties?.length ?? 0) > 0) && (
            <Section title="Education & credentials">
              <ul className="space-y-2 text-body-md text-ink-muted">
                {d.qualifications && (
                  <li className="flex items-start gap-2">
                    <GraduationCap className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> {d.qualifications}
                  </li>
                )}
                {d.registrationNumber && (
                  <li className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> Registration:{' '}
                    {d.registrationNumber}
                  </li>
                )}
                {(d.subSpecialties?.length ?? 0) > 0 && (
                  <li className="flex items-start gap-2">
                    <Stethoscope className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> {d.subSpecialties.join(', ')}
                  </li>
                )}
              </ul>
            </Section>
          )}

          {(d.languages?.length ?? 0) > 0 && (
            <Section title="Languages">
              <div className="flex flex-wrap gap-1.5">
                {d.languages.map((l) => (
                  <Tag key={l}>
                    <span className="inline-flex items-center gap-1">
                      <Languages className="h-3 w-3" /> {l}
                    </span>
                  </Tag>
                ))}
              </div>
            </Section>
          )}

          {data.appointmentTypes.length > 0 && (
            <Section title="Services & fees">
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
            </Section>
          )}
        </div>

        {/* Sticky booking widget */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <BookingWidget doctor={d} hospital={h} appointmentTypes={data.appointmentTypes} />
        </div>
      </div>
    </PublicShell>
  );
}

export default function DoctorProfilePage() {
  return (
    <Suspense
      fallback={
        <PublicShell>
          <p className="py-10 text-center text-body-sm text-ink-soft">Loading…</p>
        </PublicShell>
      }
    >
      <DoctorProfileInner />
    </Suspense>
  );
}

/** Real-slot mini-booking widget. Selecting a time deep-links into the full booking wizard. */
function BookingWidget({
  doctor,
  hospital,
  appointmentTypes,
}: {
  doctor: PublicDoctor;
  hospital: PublicHospital | null;
  appointmentTypes: PublicAppointmentType[];
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [typeId, setTypeId] = useState(appointmentTypes[0]?.id ?? '');
  const [slots, setSlots] = useState<DaySlots[] | null>(null);
  const [slotErr, setSlotErr] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const loadSlots = useCallback(async () => {
    if (!doctor.bookingEnabled) return;
    setSlots(null);
    setSlotErr(null);
    try {
      const days = await publicApi.bookingSlots(doctor.tenantId, doctor.doctorId, undefined, 14, typeId || undefined);
      setSlots(days);
      const first = days.find((dd) => dd.slots.some((s) => s.available));
      setDate(first?.date ?? '');
      setTime('');
    } catch (e) {
      setSlotErr((e as Error).message);
    }
  }, [doctor.bookingEnabled, doctor.tenantId, doctor.doctorId, typeId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const datesWithSlots = useMemo(() => (slots ?? []).filter((d) => d.slots.some((s) => s.available)), [slots]);
  const activeDay = useMemo(() => datesWithSlots.find((d) => d.date === date) ?? null, [datesWithSlots, date]);

  function go() {
    const params = new URLSearchParams();
    if (typeId) params.set('type', typeId);
    if (date) params.set('date', date);
    if (time) params.set('time', time);
    const bookFor = search.get('bookFor');
    if (bookFor) params.set('bookFor', bookFor);
    const bookForName = search.get('bookForName');
    if (bookForName) params.set('bookForName', bookForName);
    router.push(`/book/${doctor.tenantId}/${doctor.doctorId}?${params.toString()}`);
  }

  if (!doctor.bookingEnabled) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="text-title-lg font-semibold text-ink">Book an appointment</div>
        <div className="mt-3 rounded-lg border border-line bg-canvas p-3 text-body-sm text-ink-muted">
          Online booking isn&apos;t available for this doctor right now.
          {hospital?.phone && (
            <>
              {' '}
              Call{' '}
              <a href={`tel:${hospital.phone}`} className="inline-flex items-center gap-1 font-medium text-primary">
                <Phone className="h-3.5 w-3.5" /> {hospital.phone}
              </a>
              .
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <div className="text-title-lg font-semibold text-ink">Book an appointment</div>

      {appointmentTypes.length > 1 && (
        <div className="mt-4">
          <label className="mb-1.5 block text-label-md text-ink-muted">Service</label>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-body-md text-ink focus:border-primary focus:outline-none"
          >
            {appointmentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {inr(t.price)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-label-md text-ink-muted">Choose a date</label>
        {slotErr && <p className="text-body-sm text-danger-fg">{slotErr}</p>}
        {!slots && !slotErr && <p className="text-body-sm text-ink-soft">Finding available days…</p>}
        {slots && datesWithSlots.length === 0 && (
          <p className="text-body-sm text-ink-muted">No availability in the next two weeks. Please check back later.</p>
        )}
        {datesWithSlots.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {datesWithSlots.slice(0, 7).map((d) => {
              const sel = d.date === date;
              const dt = new Date(d.date);
              return (
                <button
                  key={d.date}
                  onClick={() => {
                    setDate(d.date);
                    setTime('');
                  }}
                  className={`flex min-w-[60px] flex-col items-center rounded-xl border px-2.5 py-2 transition-colors ${
                    sel ? 'border-primary bg-primary text-white' : 'border-line text-ink hover:border-primary'
                  }`}
                >
                  <span className={`text-label-sm uppercase ${sel ? 'text-white/80' : 'text-ink-soft'}`}>
                    {dt.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span className="text-title-lg font-semibold">{dt.getDate()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activeDay && (
        <div className="mt-4">
          <label className="mb-1.5 block text-label-md text-ink-muted">Available times</label>
          <div className="grid grid-cols-3 gap-2">
            {activeDay.slots
              .filter((s) => s.available)
              .slice(0, 9)
              .map((s) => {
                const sel = time === s.time;
                return (
                  <button
                    key={s.time}
                    onClick={() => setTime(s.time)}
                    className={`rounded-lg border px-2 py-2 text-label-md transition-all ${
                      sel
                        ? 'border-2 border-primary bg-primary text-white'
                        : 'border-line text-ink hover:border-primary hover:bg-primary-50'
                    }`}
                  >
                    {s.time}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      <button
        onClick={go}
        disabled={!date}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
      >
        <CalendarCheck className="h-4 w-4" /> {time ? 'Continue to book' : 'See all times'}
      </button>
      <p className="mt-2 text-center text-label-sm text-ink-soft">Payment is collected at the clinic.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <h2 className="mb-3 text-title-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href="/doctors"
      className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" /> All doctors
    </Link>
  );
}
