'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeartPulse, User } from 'lucide-react';
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
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-headline-sm font-semibold text-primary">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            HealthConnect
          </Link>
          <nav className="hidden items-center gap-1 text-body-md md:flex">
            <Link href="/hospitals" className="rounded-md px-3 py-1.5 font-medium text-ink-muted hover:bg-canvas hover:text-ink">
              Hospitals
            </Link>
            <Link href="/doctors" className="rounded-md px-3 py-1.5 font-medium text-ink-muted hover:bg-canvas hover:text-ink">
              Doctors
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {isPatientLogged === false ? (
              <Link href="/patient/login" className="rounded-lg px-3 py-1.5 text-label-md font-medium text-primary hover:bg-canvas">
                Patient Login
              </Link>
            ) : isPatientLogged === true ? (
              <Link href="/patient/dashboard" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-md font-medium text-primary hover:bg-canvas">
                <User className="h-4 w-4" /> Patient Portal
              </Link>
            ) : null}
            <Link href="/doctors" className="rounded-lg bg-primary px-4 py-1.5 text-label-md font-medium text-white hover:bg-primary-700">
              Book appointment
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-body-sm text-ink-soft">
        <span>Find hospitals and doctors, and book appointments online. © {new Date().getFullYear()} HealthConnect.</span>
        <div className="flex gap-4">
          <Link href="/patient/login" className="font-medium text-ink-muted hover:text-primary">
            Patient Portal
          </Link>
          <span className="text-line">•</span>
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
