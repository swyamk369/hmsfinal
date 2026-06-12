'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';

/**
 * Shared presentational primitives for the public directory pages (Phase 23
 * HealthConnect redesign): /doctors and /hospitals. Pure UI — all data, filtering,
 * and async wiring live in the page. No fabricated data: counts are computed from
 * real returned rows; avatars fall back to initials when no real photo/logo exists.
 */

export function initials(name: string): string {
  return (
    name
      .replace(/^Dr\.?\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/** Real photo/logo when present, else an initials chip. Never a stock photo. */
export function Avatar({
  name,
  url,
  shape = 'circle',
  size = 'md',
}: {
  name: string;
  url?: string | null;
  shape?: 'circle' | 'square';
  size?: 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-16 w-16 text-headline-sm' : 'h-14 w-14 text-title-lg';
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${dim} ${radius} flex-shrink-0 object-cover`} />;
  }
  return (
    <span
      className={`${dim} ${radius} grid flex-shrink-0 place-items-center bg-primary-100 font-semibold text-primary-700`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-canvas px-2.5 py-1 text-label-sm text-ink-muted">{children}</span>;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1.5 text-left"
    >
      <span className="text-body-md text-ink">{label}</span>
      <span
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

export function CheckRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
      />
      <span className="flex-grow text-body-md text-ink">{label}</span>
      {count != null && <span className="text-body-sm text-ink-soft">({count})</span>}
    </label>
  );
}

export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-1.5 text-label-md uppercase tracking-wide text-ink-soft">{title}</h3>
      {children}
    </div>
  );
}

export function SortSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-body-sm text-ink-muted">
      <span className="hidden sm:inline">Sort by</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-lg border border-line bg-surface py-2 pl-3 pr-8 text-body-md text-ink focus:border-primary focus:outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      </span>
    </label>
  );
}

/**
 * Two-column results layout: inline filter rail on lg+, slide-over drawer on mobile.
 * Manages its own drawer open state. `activeCount` shows a badge on the mobile button.
 */
export function ResultsLayout({
  filters,
  activeCount,
  onClearFilters,
  children,
}: {
  filters: ReactNode;
  activeCount: number;
  onClearFilters: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Panel = (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-title-lg text-ink">Filters</h2>
        <button onClick={onClearFilters} className="text-body-sm font-medium text-primary hover:underline">
          Clear all
        </button>
      </div>
      {filters}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[18rem_1fr] lg:gap-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-label-md font-medium text-ink lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" /> Filters
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-label-sm text-white">
            {activeCount}
          </span>
        )}
      </button>

      <aside className="hidden lg:block">{Panel}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-canvas p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-sm text-ink">Filters</h2>
              <button
                aria-label="Close filters"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {Panel}
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg bg-primary py-2.5 text-label-md font-medium text-white"
            >
              Show results
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );
  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-lg border border-line px-3 py-1.5 text-body-sm text-ink-muted disabled:opacity-40 hover:bg-surface"
      >
        Prev
      </button>
      {pages.map((p, i) => {
        const prev = pages[i - 1];
        return (
          <span key={p} className="flex items-center gap-1">
            {prev != null && p - prev > 1 && <span className="px-1 text-ink-soft">…</span>}
            <button
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-body-sm ${
                p === page ? 'bg-primary text-white' : 'border border-line text-ink-muted hover:bg-surface'
              }`}
            >
              {p}
            </button>
          </span>
        );
      })}
      <button
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="rounded-lg border border-line px-3 py-1.5 text-body-sm text-ink-muted disabled:opacity-40 hover:bg-surface"
      >
        Next
      </button>
    </nav>
  );
}
