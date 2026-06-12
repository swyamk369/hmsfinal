'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import { notificationsApi, type AppNotification } from '@/lib/notifications';
import { Button, cx, EmptyState, StatusChip } from './ui';

export default function NotificationBell() {
  const { activeTenantId, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const t = activeTenantId;

  const load = useCallback(async () => {
    if (!t || !profile || profile.isPlatform) return;
    setErr(null);
    try {
      const [unread, latest] = await Promise.all([
        notificationsApi.unreadCount(t),
        notificationsApi.list(t, { read: 'unread' }),
      ]);
      setCount(unread.count);
      setRows(latest.slice(0, 6));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [profile, t]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Hidden for platform users and tenant-less support staff — staff
  // notifications are tenant-scoped, so the bell would be a dead control.
  if (!profile || profile.isPlatform || (profile.isSupport && profile.tenants.length === 0)) return null;

  async function markAllRead() {
    if (!t) return;
    await notificationsApi.readAll(t);
    await load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-1.5 text-ink-muted hover:bg-canvas"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <div className="text-title-lg text-ink">Notifications</div>
                <div className="text-body-sm text-ink-soft">{count} unread</div>
              </div>
              <Button size="sm" variant="ghost" icon={CheckCheck} onClick={markAllRead} disabled={count === 0}>
                Read all
              </Button>
            </div>
            {err ? (
              <div className="px-4 py-6 text-body-sm text-danger">{err}</div>
            ) : rows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No unread notifications"
                  hint="Workflow alerts will appear here as staff actions happen."
                  icon={Bell}
                />
              </div>
            ) : (
              <div className="max-h-96 divide-y divide-line overflow-y-auto">
                {rows.map((n) => (
                  <Link
                    key={n.id}
                    href={n.actionUrl || '/notifications'}
                    onClick={() => setOpen(false)}
                    className={cx('block px-4 py-3 hover:bg-canvas', !n.readAt && 'bg-primary-50/40')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-body-sm font-medium text-ink">{n.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-body-sm text-ink-soft">{n.message}</div>
                        <div className="mt-1 text-label-sm uppercase text-ink-muted">{formatDateTime(n.createdAt)}</div>
                      </div>
                      <StatusChip status={n.severity} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <Link
                href="/settings/notifications"
                onClick={() => setOpen(false)}
                className="text-body-sm text-ink-soft hover:text-primary"
              >
                Preferences
              </Link>
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-body-sm font-medium text-primary"
              >
                View all <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
