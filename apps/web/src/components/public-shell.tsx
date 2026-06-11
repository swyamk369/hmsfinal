'use client';

import Link from 'next/link';
import { HeartPulse } from 'lucide-react';

/** Public, no-auth layout for the patient-facing directory (Phase 22.3). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/hospitals" className="flex items-center gap-2 font-semibold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            HealthConnect
          </Link>
          <nav className="flex items-center gap-1 text-body-sm">
            <Link href="/hospitals" className="rounded-md px-3 py-1.5 font-medium text-ink-muted hover:bg-canvas hover:text-ink">
              Hospitals
            </Link>
            <Link href="/doctors" className="rounded-md px-3 py-1.5 font-medium text-ink-muted hover:bg-canvas hover:text-ink">
              Doctors
            </Link>
            <Link href="/login" className="ml-1 rounded-md border border-line px-3 py-1.5 font-medium text-ink hover:bg-canvas">
              Staff login
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-body-sm text-ink-soft">
        Find hospitals and doctors, and book appointments online. © {new Date().getFullYear()} HealthConnect.
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
