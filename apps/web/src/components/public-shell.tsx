'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeartPulse, LogIn, User } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';
import { AiChatbot } from './shared/ai-chatbot';

/** Public, no-auth layout for the patient-facing directory (Phase 22.3). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const [isPatientLogged, setIsPatientLogged] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setIsPatientLogged(false);
      return;
    }
    let active = true;
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (active) setIsPatientLogged(!!user);
      });
      return () => unsub();
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f5ef]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#fbf8f1]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-headline-sm font-semibold text-[#111315]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#111315] text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="truncate">HealthConnect</span>
          </Link>
          <nav className="hidden items-center gap-1 text-body-md lg:flex">
            <Link
              href="/hospitals"
              className="rounded-full px-3 py-2 font-medium text-ink-muted hover:bg-white hover:text-ink"
            >
              Hospitals
            </Link>
            <Link
              href="/doctors"
              className="rounded-full px-3 py-2 font-medium text-ink-muted hover:bg-white hover:text-ink"
            >
              Doctors
            </Link>
            <Link
              href="/#specialties"
              className="rounded-full px-3 py-2 font-medium text-ink-muted hover:bg-white hover:text-ink"
            >
              Specialties
            </Link>
            <Link
              href="/login"
              className="rounded-full px-3 py-2 font-medium text-ink-muted hover:bg-white hover:text-ink"
            >
              Staff login
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {isPatientLogged === false ? (
              <Link
                href="/patient/login"
                className="hidden rounded-full border border-black/10 bg-white/70 px-3 py-2 text-label-md font-semibold text-ink hover:bg-white sm:inline-flex"
              >
                Patient login
              </Link>
            ) : isPatientLogged === true ? (
              <Link
                href="/patient/dashboard"
                className="hidden items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-label-md font-semibold text-ink hover:bg-white sm:flex"
              >
                <User className="h-4 w-4" /> Patient Portal
              </Link>
            ) : null}
            <Link
              href="/doctors"
              className="rounded-full bg-[#111315] px-4 py-2 text-label-md font-semibold text-white shadow-sm hover:bg-black"
            >
              <span className="hidden sm:inline">Book appointment</span>
              <span className="sm:hidden">Book</span>
            </Link>
            {isPatientLogged === false ? (
              <Link
                href="/patient/login"
                aria-label="Patient login"
                className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/70 text-ink hover:bg-white sm:hidden"
              >
                <LogIn className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-8 text-center text-body-sm text-ink-soft">
        <span>
          Find hospitals and doctors, and book appointments online. © {new Date().getFullYear()} HealthConnect.
        </span>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/hospitals" className="font-medium text-ink-muted hover:text-ink">
            Hospitals
          </Link>
          <Link href="/doctors" className="font-medium text-ink-muted hover:text-ink">
            Doctors
          </Link>
          <Link href="/#specialties" className="font-medium text-ink-muted hover:text-ink">
            Specialties
          </Link>
          <Link href="/patient/login" className="font-medium text-ink-muted hover:text-primary">
            Patient Portal
          </Link>
          <Link href="/login" className="font-medium text-ink-muted hover:text-primary">
            Hospital staff login
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-body-md text-ink placeholder:text-ink-soft focus:border-primary focus:outline-none"
      />
      <button type="submit" className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:opacity-90">
        Search
      </button>
    </form>
  );
}
