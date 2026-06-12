'use client';

import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';

/**
 * Shared UI primitives for the public booking flow (Phase 23 HealthConnect
 * redesign). Pure presentational; all data and async wiring live in the page.
 * Material-You reference design mapped to our existing tokens.
 */

export const BOOKING_STEPS = ['Select', 'Time', 'Details', 'Review', 'Confirm'] as const;

/** Transactional chrome: minimal top bar (close + stepper) + sticky action footer. */
export function BookingChrome({
  current,
  onClose,
  title = 'Book Appointment',
  footer,
  children,
}: {
  current: number; // 1-based index into BOOKING_STEPS
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas pb-28">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 md:flex-row md:gap-8">
          <div className="flex w-full items-center justify-between gap-2 md:w-auto">
            <button
              aria-label="Cancel booking"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
            <h1 className="text-headline-sm text-ink md:hidden">{title}</h1>
            <span className="w-9 md:hidden" />
          </div>
          <div className="mx-auto w-full max-w-2xl">
            <BookingStepper current={current} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-grow px-4 py-6 md:px-6 md:py-8">{children}</main>

      {footer && (
        <footer className="fixed bottom-0 left-0 z-40 w-full border-t border-line bg-surface/95 shadow-[0_-4px_12px_rgba(15,23,41,0.05)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-6">{footer}</div>
        </footer>
      )}
    </div>
  );
}

export function BookingStepper({ current }: { current: number }) {
  return (
    <ol className="relative flex items-center justify-between">
      <span className="absolute left-0 top-4 -z-0 h-0.5 w-full bg-line" aria-hidden />
      <span
        className="absolute left-0 top-4 -z-0 h-0.5 bg-primary transition-all"
        style={{ width: `${Math.max(0, Math.min(100, ((current - 1) / (BOOKING_STEPS.length - 1)) * 100))}%` }}
        aria-hidden
      />
      {BOOKING_STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="relative z-10 flex flex-col items-center gap-1">
            <span
              className={[
                'grid h-8 w-8 place-items-center rounded-full border-2 bg-surface text-label-md transition-colors',
                done
                  ? 'border-primary bg-primary text-white'
                  : active
                    ? 'border-primary text-primary'
                    : 'border-line text-ink-soft',
              ].join(' ')}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </span>
            <span
              className={`hidden text-label-sm md:block ${active ? 'text-primary' : done ? 'text-ink' : 'text-ink-soft'}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProviderCard({
  name,
  specialty,
  hospital,
  acceptsNew,
}: {
  name: string;
  specialty?: string | null;
  hospital: string;
  acceptsNew?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-full bg-primary-100 text-headline-md font-semibold text-primary-700">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-headline-sm text-ink">{name}</h2>
          {specialty && <p className="text-body-sm text-ink-muted">{specialty}</p>}
          <p className="truncate text-body-sm text-ink-soft">{hospital}</p>
        </div>
      </div>
      {acceptsNew && (
        <>
          <div className="h-px w-full bg-line" />
          <div className="flex items-center gap-2 text-primary">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-50">
              <Check className="h-3 w-3" />
            </span>
            <span className="text-label-md">Accepting new patients</span>
          </div>
        </>
      )}
    </section>
  );
}

export function ServiceOption({
  selected,
  name,
  durationMinutes,
  priceLabel,
  onSelect,
}: {
  selected: boolean;
  name: string;
  durationMinutes: number;
  priceLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-all',
        selected
          ? 'border-2 border-primary bg-primary-50 shadow-sm'
          : 'border border-line bg-surface hover:border-primary',
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <span className={`text-label-md ${selected ? 'font-bold text-primary' : 'text-ink'}`}>{name}</span>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? 'border-primary bg-primary text-white' : 'border-line'}`}
        >
          {selected && <Check className="h-3 w-3" />}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-body-sm text-ink-muted">{durationMinutes} min</span>
        <span className="text-label-md text-ink">{priceLabel}</span>
      </div>
    </button>
  );
}

/** Splits time strings (e.g. "09:30 AM" or "14:00") into Morning / Afternoon / Evening. */
export function groupByPartOfDay<T extends { time: string }>(slots: T[]): { label: string; slots: T[] }[] {
  const groups: Record<string, T[]> = { Morning: [], Afternoon: [], Evening: [] };
  for (const s of slots) {
    const h = hour24(s.time);
    if (h < 12) groups.Morning.push(s);
    else if (h < 17) groups.Afternoon.push(s);
    else groups.Evening.push(s);
  }
  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, slots: list }));
}

function hour24(time: string): number {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h;
}

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
