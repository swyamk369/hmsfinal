'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Building2, MapPin, Phone, Globe, Mail, Clock, Video, Languages, ShieldCheck, CalendarCheck } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { Avatar, Tag } from '@/components/patient/directory-ui';
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
        <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center text-body-md text-ink-muted">{err}</div>
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

  const h = data.hospital;
  const telehealth = (h.consultationTypes ?? []).includes('TELEHEALTH');

  return (
    <PublicShell>
      <BackLink />

      {/* Cover + identity */}
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        {h.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={h.coverImageUrl} alt="" className="h-32 w-full object-cover sm:h-40" />
        ) : (
          <div className="h-28 bg-gradient-to-r from-primary-100 to-primary-50 sm:h-32" />
        )}
        <div className="px-6 pb-6">
          <div className="-mt-8 mb-3">
            <Avatar name={h.name} url={h.logoUrl} shape="square" size="lg" />
          </div>
          <h1 className="text-headline-md font-semibold text-ink">{h.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-ink-muted">
            {(h.address || h.city) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {[h.address, h.city, h.state].filter(Boolean).join(', ')}
              </span>
            )}
            {h.phone && (
              <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                <Phone className="h-4 w-4" /> {h.phone}
              </a>
            )}
            {h.email && (
              <a href={`mailto:${h.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                <Mail className="h-4 w-4" /> {h.email}
              </a>
            )}
            {h.website && (
              <a href={h.website} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {h.description && (
            <Section title="About">
              <p className="text-body-md leading-relaxed text-ink-muted">{h.description}</p>
            </Section>
          )}

          {(h.specialties?.length ?? 0) > 0 && (
            <Section title="Departments & specialties">
              <ChipRow items={h.specialties} />
            </Section>
          )}

          {(h.facilities?.length ?? 0) > 0 && (
            <Section title="Key facilities">
              <ChipRow items={h.facilities} />
            </Section>
          )}

          {data.appointmentTypes.length > 0 && (
            <Section title="Services & fees">
              <div className="divide-y divide-line">
                {data.appointmentTypes.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{t.name}</div>
                      <div className="text-body-sm text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {t.durationMinutes} min
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold text-ink">{inr(t.price)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-body-sm text-ink-soft">Choose a doctor below to book one of these services online.</p>
            </Section>
          )}

          <Section title="Top specialists">
            {data.doctors.length === 0 ? (
              <p className="text-body-sm text-ink-soft">No public doctor profiles yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.doctors.map((d) => (
                  <div key={d.doctorId} className="flex items-center gap-3 rounded-lg border border-line p-3">
                    <Avatar name={d.name} url={d.photoUrl} />
                    <div className="min-w-0 flex-grow">
                      <Link href={`/doctors/${d.slug}`} className="font-semibold text-ink hover:text-primary">
                        {d.name}
                      </Link>
                      {d.specialty && <div className="truncate text-body-sm text-ink-muted">{d.specialty}</div>}
                      <div className="mt-1.5 flex gap-2">
                        <Link href={`/doctors/${d.slug}`} className="text-label-md font-medium text-primary hover:underline">
                          View profile
                        </Link>
                        {d.bookingEnabled && (
                          <Link href={`/book/${d.tenantId}/${d.doctorId}`} className="text-label-md font-medium text-primary hover:underline">
                            Book
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Quick info */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-line bg-surface p-6">
            <h2 className="mb-3 text-title-lg font-semibold text-ink">Quick info</h2>
            <dl className="space-y-3 text-body-sm">
              <InfoRow icon={<Video className="h-4 w-4" />} label="Telehealth" value={telehealth ? 'Available' : 'Not offered'} />
              {(h.languages?.length ?? 0) > 0 && (
                <InfoRow icon={<Languages className="h-4 w-4" />} label="Languages" value={h.languages.join(', ')} />
              )}
              {(h.insuranceAccepted?.length ?? 0) > 0 && (
                <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Insurance" value={h.insuranceAccepted!.join(', ')} />
              )}
              {h.bookingEnabled && (
                <InfoRow icon={<CalendarCheck className="h-4 w-4" />} label="Booking" value="Online booking available" />
              )}
            </dl>
            {data.doctors.some((d) => d.bookingEnabled) && (
              <a
                href="#top-specialists"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('top-specialists')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="mt-5 hidden w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary-700 lg:inline-flex"
              >
                <CalendarCheck className="h-4 w-4" /> Book an appointment
              </a>
            )}
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = title.toLowerCase().includes('specialist') ? 'top-specialists' : undefined;
  return (
    <section id={id} className="rounded-xl border border-line bg-surface p-6">
      <h2 className="mb-3 text-title-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <Tag key={s}>{s}</Tag>
      ))}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-ink-soft">{icon}</span>
      <div>
        <dt className="text-label-sm uppercase tracking-wide text-ink-soft">{label}</dt>
        <dd className="text-ink">{value}</dd>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/hospitals" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> All hospitals
    </Link>
  );
}
