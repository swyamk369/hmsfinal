'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/** Shared presentational primitives + a tiny data hook for the patient portal routes. */

export function useData<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    setData(null);
    setErr(null);
    fn()
      .then(setData)
      .catch((e) => setErr((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => load(), [load]);
  return { data, err, reload: load };
}

const POSITIVE = [
  'PAID',
  'CONFIRMED',
  'COMPLETED',
  'SCHEDULED',
  'ACTIVE',
  'VERIFIED',
  'APPROVED',
  'FINALIZED',
  'NORMAL',
];
const NEGATIVE = ['CANCELLED', 'REJECTED', 'CRITICAL', 'HIGH', 'LOW', 'UNPAID', 'NO_SHOW', 'BLOCKED'];
const PENDINGY = [
  'PENDING',
  'PARTIAL',
  'DUE',
  'UNDER_REVIEW',
  'PENDING_STAFF_APPROVAL',
  'DRAFT',
  'IN_PROGRESS',
  'CHECKED_IN',
];

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const tone = POSITIVE.includes(s)
    ? 'bg-success-bg text-success-fg'
    : NEGATIVE.includes(s)
      ? 'bg-danger-bg text-danger-fg'
      : PENDINGY.includes(s)
        ? 'bg-warning-bg text-warning-fg'
        : 'bg-canvas text-ink-muted';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-label-sm font-medium ${tone}`}>
      {prettyStatus(status)}
    </span>
  );
}

export function prettyStatus(s: string): string {
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-body-sm text-ink-soft">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-canvas text-ink-soft">
        <Icon className="h-6 w-6" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-body-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{msg}</div>
  );
}

/** Underline sub-tabs (Upcoming / Past, Unpaid / Paid, etc.). */
export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-body-sm font-medium ${
            value === t.key ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-ink-soft">({t.count})</span>}
        </button>
      ))}
    </div>
  );
}

export const portalMoney = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN');
