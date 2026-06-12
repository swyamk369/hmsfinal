'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  Stethoscope,
  HeartPulse,
  Baby,
  Brain,
  Bone,
  Eye,
  ShieldCheck,
  CalendarCheck,
  FolderLock,
} from 'lucide-react';
import { PublicShell } from '@/components/public-shell';

const SPECIALTIES: { label: string; icon: typeof Stethoscope }[] = [
  { label: 'General Physician', icon: Stethoscope },
  { label: 'Cardiology', icon: HeartPulse },
  { label: 'Pediatrics', icon: Baby },
  { label: 'Neurology', icon: Brain },
  { label: 'Orthopedics', icon: Bone },
  { label: 'Ophthalmology', icon: Eye },
];

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');

  function search(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (city.trim()) params.set('city', city.trim());
    router.push(`/doctors${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden rounded-b-2xl bg-gradient-to-b from-primary-50 to-canvas px-4 pb-12 pt-10 md:pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-display-lg text-ink md:text-4xl md:leading-tight">
            Find and book healthcare appointments online
          </h1>
          <p className="mt-4 max-w-2xl text-body-lg text-ink-muted">
            Search doctors and hospitals, see real-time availability, and manage your visits securely — one login across
            every hospital you visit.
          </p>

          <form
            onSubmit={search}
            className="mt-8 w-full max-w-3xl rounded-xl border border-line bg-surface p-3 shadow-sm md:flex md:items-center md:gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Doctor, specialty, or condition"
                className="w-full rounded-lg border border-line bg-canvas py-3 pl-10 pr-3 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="relative mt-2 flex-1 md:mt-0">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full rounded-lg border border-line bg-canvas py-3 pl-10 pr-3 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="mt-2 w-full whitespace-nowrap rounded-lg bg-primary px-6 py-3 text-label-md font-medium text-white transition-colors hover:bg-primary-700 md:mt-0 md:w-auto"
            >
              Search
            </button>
          </form>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SPECIALTIES.map(({ label, icon: Icon }) => (
              <Link
                key={label}
                href={`/doctors?specialty=${encodeURIComponent(label)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-label-md text-ink-muted transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-3">
        <Feature
          icon={CalendarCheck}
          title="Real-time booking"
          body="See genuine open slots from each hospital's schedule and book in a few taps."
        />
        <Feature
          icon={FolderLock}
          title="Your records, in one place"
          body="Access appointments, bills, prescriptions, and shared reports across hospitals."
        />
        <Feature
          icon={ShieldCheck}
          title="Private & secure"
          body="One login, separate records per hospital. Your data is isolated and never shared between hospitals."
        />
      </section>

      {/* CTA */}
      <section className="mx-auto mt-12 flex max-w-5xl flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <h2 className="text-headline-md text-ink">Ready to see a doctor?</h2>
        <p className="max-w-xl text-body-md text-ink-muted">
          Browse specialists and hospitals near you, or sign in to manage your care.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link
            href="/doctors"
            className="rounded-lg bg-primary px-6 py-2.5 text-label-md font-medium text-white hover:bg-primary-700"
          >
            Find a doctor
          </Link>
          <Link
            href="/hospitals"
            className="rounded-lg border border-line px-6 py-2.5 text-label-md font-medium text-ink hover:bg-canvas"
          >
            Browse hospitals
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof Stethoscope; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-50 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-title-lg text-ink">{title}</h3>
      <p className="mt-1 text-body-sm text-ink-muted">{body}</p>
    </div>
  );
}
