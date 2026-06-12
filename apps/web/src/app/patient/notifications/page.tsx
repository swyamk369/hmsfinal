'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, CalendarDays, FileText, Receipt, Pill } from 'lucide-react';
import { portalApi, type PatientNotificationItem } from '@/lib/patient-portal';
import { Loading, EmptyState, ErrorState } from '@/components/patient/portal-ui';

const ICON: Record<string, typeof Bell> = {
  BOOKING: CalendarDays,
  DOCUMENT: FileText,
  BILLING: Receipt,
  REFILL: Pill,
  GENERAL: Bell,
};

export default function NotificationsPage() {
  const [items, setItems] = useState<PatientNotificationItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await portalApi.notifications();
      setItems(res.items);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAll() {
    setBusy(true);
    try {
      await portalApi.markAllNotificationsRead();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: string) {
    await portalApi.markNotificationRead(id).catch(() => {});
    await load();
  }

  if (err) return <ErrorState msg={err} />;
  if (!items) return <Loading label="Loading notifications…" />;

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-headline-md text-ink">Notifications</h1>
          <p className="text-body-sm text-ink-muted">{unread > 0 ? `${unread} unread` : 'You’re all caught up.'}</p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-label-md font-medium text-ink hover:bg-canvas disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          body="Updates about your bookings, documents, and refills will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICON[n.category] ?? Bell;
            const inner = (
              <div
                className={`flex items-start gap-3 rounded-xl border p-4 ${n.readAt ? 'border-line bg-surface' : 'border-primary/30 bg-primary-50'}`}
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full ${n.readAt ? 'bg-canvas text-ink-soft' : 'bg-primary-100 text-primary-700'}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink">{n.title}</p>
                    {!n.readAt && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-body-sm text-ink-muted">{n.body}</p>}
                  <p className="mt-1 text-label-sm text-ink-soft">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} onClick={() => !n.readAt && void markOne(n.id)} className="cursor-pointer">
                {n.actionUrl ? <Link href={n.actionUrl}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
