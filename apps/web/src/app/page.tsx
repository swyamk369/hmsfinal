'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  Baby,
  BellRing,
  Brain,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  HeartPulse,
  LockKeyhole,
  MapPin,
  Pill,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { PublicShell } from '@/components/public-shell';

const IMG = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=82`;

const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.visibility = 'hidden';
};

const SPECIALTIES = [
  { label: 'General Physician', icon: Stethoscope, href: '/doctors?specialty=General%20Physician' },
  { label: 'Cardiology', icon: HeartPulse, href: '/doctors?specialty=Cardiology' },
  { label: 'Pediatrics', icon: Baby, href: '/doctors?specialty=Pediatrics' },
  { label: 'Neurology', icon: Brain, href: '/doctors?specialty=Neurology' },
  { label: 'Orthopedics', icon: Activity, href: '/doctors?specialty=Orthopedics' },
  { label: 'Ophthalmology', icon: Eye, href: '/doctors?specialty=Ophthalmology' },
];

const FEATURED = [
  {
    name: 'Dr. Anya Sharma',
    specialty: 'Cardiology',
    hospital: 'Victoria Harbour Medical',
    availability: 'Today, 3:30 PM',
    rating: '4.9',
    href: '/doctors?specialty=Cardiology',
  },
  {
    name: 'Sunrise Clinic',
    specialty: 'Family care',
    hospital: 'Multi-specialty hospital',
    availability: 'Tomorrow, 10:00 AM',
    rating: '4.8',
    href: '/hospitals',
  },
];

const PORTAL_ITEMS = [
  { label: 'Upcoming appointment', value: 'Dr. Anya Sharma', icon: CalendarCheck },
  { label: 'Prescriptions', value: '2 active medicines', icon: Pill },
  { label: 'Lab reports', value: 'CBC ready to view', icon: FileText },
  { label: 'Notifications', value: '3 secure updates', icon: BellRing },
];

const STATS = [
  ['120+', 'partner hospitals'],
  ['3.5k+', 'verified clinicians'],
  ['250k+', 'patients served'],
];

function useScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.hc-reveal'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('hc-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('hc-in');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -56px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function HomePage() {
  const router = useRouter();
  useScrollReveal();

  const [mode, setMode] = useState<'doctors' | 'hospitals'>('doctors');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');

  function search(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (city.trim()) params.set('city', city.trim());
    const base = mode === 'doctors' ? '/doctors' : '/hospitals';
    router.push(`${base}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <PublicShell>
      <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-[#fbf8f1] shadow-[0_28px_90px_rgba(18,24,38,0.08)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.95),transparent_30%),linear-gradient(120deg,rgba(244,236,222,0.78),rgba(255,255,255,0.86)_42%,rgba(233,246,243,0.72))]"
        />
        <div className="relative grid gap-8 px-5 py-8 md:px-10 md:py-12 lg:grid-cols-[1.02fr_.98fr] lg:px-14 lg:py-16">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="hc-enter hc-d1 inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/72 px-3 py-1.5 text-label-md font-semibold text-ink-muted shadow-sm backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-success-fg" />
              Verified hospitals, real appointments, secure patient access
            </div>

            <h1 className="hc-enter hc-d2 mt-6 max-w-3xl break-words text-[38px] font-semibold leading-[1.03] tracking-[-0.02em] text-[#111315] sm:text-[48px] md:text-[64px] lg:text-[72px]">
              Your health, elevated.
              <span className="block">Premium care, booked with confidence.</span>
            </h1>

            <p className="hc-enter hc-d3 mt-5 max-w-2xl text-body-lg text-ink-muted md:text-[18px] md:leading-7">
              Search verified hospitals, compare doctors, view real-time availability, and manage every visit securely
              from one patient portal.
            </p>

            <div className="hc-enter hc-d4 mt-7 flex flex-wrap gap-3">
              <Link
                href="/doctors"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111315] px-5 py-3 text-label-md font-semibold text-white shadow-[0_14px_30px_rgba(17,19,21,0.18)] transition-all hover:-translate-y-0.5 hover:bg-black"
              >
                Book appointment <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/patient/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/78 px-5 py-3 text-label-md font-semibold text-ink shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                Patient portal
              </Link>
              <Link
                href="/hospitals"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/60 px-5 py-3 text-label-md font-semibold text-ink-muted backdrop-blur transition-all hover:-translate-y-0.5 hover:text-ink"
              >
                Browse hospitals
              </Link>
            </div>

            <form
              onSubmit={search}
              className="hc-enter hc-d5 mt-8 rounded-[24px] border border-black/10 bg-white/86 p-2 shadow-[0_22px_60px_rgba(17,24,39,0.13)] backdrop-blur-xl lg:max-w-3xl"
            >
              <div className="mb-2 inline-flex rounded-full bg-[#f4f1ea] p-1 text-label-md font-semibold">
                <button
                  type="button"
                  onClick={() => setMode('doctors')}
                  className={`rounded-full px-3 py-2 transition-colors ${
                    mode === 'doctors' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Doctors
                </button>
                <button
                  type="button"
                  onClick={() => setMode('hospitals')}
                  className={`rounded-full px-3 py-2 transition-colors ${
                    mode === 'hospitals' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Hospitals
                </button>
              </div>

              <div className="grid gap-2 lg:grid-cols-[1.2fr_.85fr_auto] lg:items-center">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={mode === 'doctors' ? 'Doctor, condition, or specialty' : 'Hospital, service, or name'}
                    className="h-12 w-full rounded-full border border-transparent bg-[#f7f5ef] pl-11 pr-4 text-body-md text-ink outline-none transition focus:border-black/10 focus:bg-white"
                  />
                </label>

                <label className="relative block">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City or hospital"
                    className="h-12 w-full rounded-full border border-transparent bg-[#f7f5ef] pl-11 pr-4 text-body-md text-ink outline-none transition focus:border-black/10 focus:bg-white"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#111315] px-5 text-label-md font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-black"
                >
                  Search now
                </button>
              </div>
            </form>

            <div className="hc-enter hc-d5 mt-5 flex flex-wrap gap-2" id="specialties">
              {SPECIALTIES.map(({ label, icon: Icon, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/62 px-3 py-2 text-label-md font-semibold text-ink-muted backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:text-ink"
                >
                  <Icon className="h-4 w-4 text-[#0f9d6f]" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <HeroVisual />
        </div>
      </section>

      <section className="mx-auto mt-10 grid gap-3 md:grid-cols-3">
        {STATS.map(([value, label]) => (
          <div key={label} className="hc-reveal rounded-lg border border-black/10 bg-white px-5 py-4 shadow-sm">
            <div className="text-3xl font-semibold tracking-tight text-[#111315]">{value}</div>
            <div className="mt-1 text-body-sm font-medium uppercase tracking-wide text-ink-soft">{label}</div>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-16">
        <SectionHead eyebrow="Popular specialties" title="Find the right care faster" />
        <div className="hc-reveal hc-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SPECIALTIES.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-lg border border-black/10 bg-white p-4 shadow-[0_16px_40px_rgba(17,24,39,0.06)] transition-all hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_24px_50px_rgba(17,24,39,0.10)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f4efe4] text-[#111315] transition-colors group-hover:bg-[#111315] group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <div className="mt-4 text-title-lg text-ink">{label}</div>
              <div className="mt-2 inline-flex items-center gap-1 text-label-md font-semibold text-ink-soft group-hover:text-ink">
                View doctors <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16">
        <SectionHead eyebrow="Featured care network" title="Real care access, ready to book" />
        <div className="grid gap-5 lg:grid-cols-[1fr_.82fr]">
          <div className="hc-reveal overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_24px_70px_rgba(17,24,39,0.08)]">
            <div className="grid md:grid-cols-[.9fr_1.1fr]">
              <div className="relative min-h-[280px] bg-[#ede6db]">
                <img
                  src={IMG('1622253692010-333f2da6031d', 800)}
                  onError={hideOnError}
                  alt="Doctor reviewing care options"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-6 md:p-8">
                <span className="inline-flex items-center gap-2 rounded-full bg-success-bg px-3 py-1 text-label-md font-semibold text-success-fg">
                  <CheckCircle2 className="h-4 w-4" />
                  Verified provider
                </span>
                <h3 className="mt-5 text-3xl font-semibold tracking-[-0.01em] text-ink">Book from live availability</h3>
                <p className="mt-3 text-body-md text-ink-muted">
                  Compare doctors, hospitals, specialties, and available appointment slots without switching systems.
                </p>
                <div className="mt-6 grid gap-3">
                  {FEATURED.map((item) => (
                    <FeaturedRow key={item.name} {...item} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hc-reveal rounded-lg border border-black/10 bg-[#fbf8f1] p-5 shadow-[0_24px_70px_rgba(17,24,39,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-label-md font-semibold uppercase tracking-wide text-ink-soft">How it works</div>
                <h3 className="mt-1 text-2xl font-semibold text-ink">Three clear steps</h3>
              </div>
              <CalendarCheck className="h-8 w-8 text-[#0f9d6f]" />
            </div>
            <div className="mt-5 grid gap-3">
              <Step
                n="01"
                title="Search care"
                body="Find doctors or hospitals by specialty, condition, service, or city."
              />
              <Step
                n="02"
                title="Choose a slot"
                body="Open real provider profiles and pick an available appointment."
              />
              <Step
                n="03"
                title="Manage securely"
                body="Use the patient portal for visits, bills, prescriptions, and reports."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 grid gap-6 rounded-[24px] border border-black/10 bg-[#f5efe5] p-5 shadow-[0_30px_90px_rgba(17,24,39,0.06)] md:grid-cols-[.9fr_1.1fr] md:p-8">
        <div className="hc-reveal flex flex-col justify-center">
          <span className="text-label-md font-semibold uppercase tracking-wide text-ink-soft">
            Patient portal preview
          </span>
          <h2 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            Your visits, records, and care team in one secure place.
          </h2>
          <p className="mt-3 max-w-md text-body-lg text-ink-muted">
            Patients can access appointments, prescriptions, bills, reports, notifications, and support from a single
            portal.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/patient/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111315] px-5 py-3 text-label-md font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-black"
            >
              Sign in to patient portal
            </Link>
            <Link
              href="/patient/register"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/75 px-5 py-3 text-label-md font-semibold text-ink transition-all hover:-translate-y-0.5 hover:bg-white"
            >
              Create account
            </Link>
          </div>
        </div>

        <div className="hc-reveal grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-[0_24px_60px_rgba(17,24,39,0.10)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-title-lg text-ink">Upcoming appointments</span>
              <Clock3 className="h-5 w-5 text-ink-soft" />
            </div>
            {PORTAL_ITEMS.slice(0, 2).map(({ label, value, icon: Icon }) => (
              <div key={label} className="mb-3 flex items-center gap-3 rounded-lg border border-line bg-canvas p-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#111315]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-body-sm font-semibold text-ink">{value}</div>
                  <div className="text-label-sm text-ink-soft">{label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-[0_24px_60px_rgba(17,24,39,0.10)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-title-lg text-ink">Care records</span>
              <LockKeyhole className="h-5 w-5 text-success-fg" />
            </div>
            {PORTAL_ITEMS.slice(2).map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#111315]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-body-sm font-semibold text-ink">{value}</div>
                    <div className="text-label-sm text-ink-soft">{label}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-soft" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16">
        <SectionHead eyebrow="Trust and security" title="Private by design, useful by default" />
        <div className="hc-reveal hc-stagger grid gap-4 md:grid-cols-3">
          <TrustCard
            icon={ShieldCheck}
            title="Verified hospital profiles"
            body="Patients browse published hospitals and doctors with trusted public profiles."
          />
          <TrustCard
            icon={LockKeyhole}
            title="Secure patient identity"
            body="Firebase-backed sign-in keeps patient access protected across the portal."
          />
          <TrustCard
            icon={BellRing}
            title="Real-time care updates"
            body="Appointment, billing, prescription, and report notifications stay connected."
          />
        </div>
      </section>

      <section className="mx-auto mt-16 overflow-hidden rounded-[24px] bg-[#111315] p-6 text-white shadow-[0_28px_90px_rgba(17,19,21,0.22)] md:p-10">
        <div className="hc-reveal grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="text-label-md font-semibold uppercase tracking-wide text-white/55">
              Start with care today
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.01em] md:text-5xl">
              Find care, book a visit, or open your patient portal.
            </h2>
            <p className="mt-3 max-w-2xl text-body-lg text-white/70">
              Every core HealthConnect workflow is one tap away.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link
              href="/doctors"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-label-md font-semibold text-[#111315] transition-all hover:-translate-y-0.5"
            >
              Book appointment
            </Link>
            <Link
              href="/hospitals"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-label-md font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/15"
            >
              Search hospitals
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-5 py-3 text-label-md font-semibold text-white/80 transition-all hover:-translate-y-0.5 hover:text-white"
            >
              Staff login
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function HeroVisual() {
  return (
    <div className="hc-enter hc-d3 relative min-h-[420px] lg:min-h-[560px]">
      <div className="absolute right-0 top-8 h-[420px] w-[78%] overflow-hidden rounded-[28px] bg-[#e8e0d5] shadow-[0_30px_90px_rgba(17,24,39,0.16)]">
        <img
          src={IMG('1559839734-2b71ea197ec2', 1000)}
          onError={hideOnError}
          alt="Doctor consulting with a patient"
          className="h-full w-full object-cover"
          loading="eager"
        />
      </div>

      <div className="hc-float absolute left-0 top-12 w-[260px] rounded-lg border border-black/10 bg-white/88 p-4 shadow-[0_20px_50px_rgba(17,24,39,0.14)] backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-[#ece7dc]">
            <UserRound className="h-6 w-6 text-ink-muted" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-body-md font-semibold text-ink">Dr. Anya Sharma</div>
            <div className="text-label-sm text-ink-soft">Cardiologist</div>
            <div className="mt-1 inline-flex items-center gap-1 text-label-sm font-semibold text-[#9a6a00]">
              <Star className="h-3.5 w-3.5 fill-[#e6a700] text-[#e6a700]" /> 4.9 Top rated
            </div>
          </div>
        </div>
      </div>

      <div className="hc-float-slow absolute bottom-16 left-8 rounded-lg border border-black/10 bg-white/90 p-4 shadow-[0_20px_50px_rgba(17,24,39,0.14)] backdrop-blur">
        <div className="text-label-sm uppercase tracking-wide text-ink-soft">Next available</div>
        <div className="mt-1 text-title-lg text-ink">Tomorrow, 10:00 AM</div>
        <Link href="/doctors" className="mt-3 inline-flex items-center gap-1 text-label-md font-semibold text-ink">
          Book now <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="absolute right-2 top-20 rounded-lg border border-black/10 bg-white/88 p-3 shadow-[0_20px_50px_rgba(17,24,39,0.12)] backdrop-blur">
        <div className="grid grid-cols-4 gap-1 text-center text-label-sm">
          {['M', 'T', 'W', 'S'].map((d) => (
            <div key={d} className="text-ink-soft">
              {d}
            </div>
          ))}
          {['17', '18', '19', '30'].map((d) => (
            <div
              key={d}
              className={`rounded-full px-2 py-1 ${d === '19' ? 'bg-[#111315] text-white' : 'bg-[#f4f1ea] text-ink'}`}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-7 right-0 flex items-center gap-3 rounded-lg border border-black/10 bg-white/90 px-4 py-3 shadow-[0_20px_50px_rgba(17,24,39,0.14)] backdrop-blur">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-success-bg text-success-fg">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <div className="text-body-sm font-semibold text-ink">Secure record</div>
          <div className="text-label-sm text-ink-soft">Privacy-first access</div>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="hc-reveal mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="text-label-md font-semibold uppercase tracking-wide text-ink-soft">{eyebrow}</div>
        <h2 className="mt-1 text-3xl font-semibold tracking-[-0.01em] text-ink md:text-4xl">{title}</h2>
      </div>
      <Link
        href="/doctors"
        className="inline-flex items-center gap-1 text-label-md font-semibold text-ink hover:text-primary"
      >
        Explore care network <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function FeaturedRow({
  name,
  specialty,
  hospital,
  availability,
  rating,
  href,
}: {
  name: string;
  specialty: string;
  hospital: string;
  availability: string;
  rating: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-line bg-canvas p-4 transition-all hover:-translate-y-0.5 hover:bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-title-lg text-ink">{name}</div>
          <div className="text-body-sm text-ink-muted">{specialty}</div>
          <div className="mt-1 text-label-sm uppercase tracking-wide text-ink-soft">{hospital}</div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-label-sm font-semibold text-ink">
          <Star className="h-3.5 w-3.5 fill-[#e6a700] text-[#e6a700]" />
          {rating}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-label-sm text-ink-soft">Next available</div>
          <div className="text-body-sm font-semibold text-ink">{availability}</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#111315] px-3 py-2 text-label-sm font-semibold text-white">
          Book <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white/70 p-4">
      <div className="text-label-md font-semibold text-ink-soft">{n}</div>
      <div className="mt-2 text-title-lg text-ink">{title}</div>
      <p className="mt-1 text-body-sm text-ink-muted">{body}</p>
    </div>
  );
}

function TrustCard({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-5 shadow-[0_18px_44px_rgba(17,24,39,0.06)]">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f4efe4] text-[#111315]">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-title-lg text-ink">{title}</h3>
      <p className="mt-2 text-body-sm text-ink-muted">{body}</p>
    </div>
  );
}
