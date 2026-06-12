'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, Bell, Check, CheckCheck, ExternalLink, Filter } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SEVERITIES,
  notificationsApi,
  type AppNotification,
} from '@/lib/notifications';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  PageHeader,
  Section,
  Select,
  Spinner,
  StatusChip,
  cx,
} from '@/components/ui';
import { HelpTip } from '@/components/operations';

function NotificationRow({ row, onChanged }: { row: AppNotification; onChanged: () => Promise<void> }) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [busy, setBusy] = useState<string | null>(null);

  async function act(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    try {
      await fn();
      await onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cx('grid gap-4 px-5 py-4 lg:grid-cols-[1fr_auto]', !row.readAt && 'bg-primary-50/35')}>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="primary">{row.category}</Badge>
          <StatusChip status={row.severity} />
          {!row.readAt && <Badge tone="warning">Unread</Badge>}
          <span className="text-body-sm text-ink-soft">{formatDateTime(row.createdAt)}</span>
        </div>
        <div className="text-title-lg text-ink">{row.title}</div>
        <p className="mt-1 max-w-3xl text-body-md text-ink-muted">{row.message}</p>
        {row.deliveryAttempts?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {row.deliveryAttempts.map((attempt) => (
              <span key={attempt.id} className="rounded bg-canvas px-2 py-1 text-label-sm uppercase text-ink-soft">
                {attempt.channel}: {attempt.status}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-start gap-2 lg:justify-end">
        {row.actionUrl && (
          <Link href={row.actionUrl}>
            <Button size="sm" variant="ghost" icon={ExternalLink}>
              Open
            </Button>
          </Link>
        )}
        {!row.readAt && (
          <Button
            size="sm"
            variant="ghost"
            icon={Check}
            loading={busy === 'read'}
            onClick={() => act('read', () => notificationsApi.markRead(t, row.id))}
          >
            Read
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          icon={Archive}
          loading={busy === 'archive'}
          onClick={() => act('archive', () => notificationsApi.archive(t, row.id))}
        >
          Archive
        </Button>
      </div>
    </div>
  );
}

function NotificationsInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [read, setRead] = useState('unread');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => ({ read, category, severity }), [category, read, severity]);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    setLoading(true);
    try {
      setRows(await notificationsApi.list(t, params));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function readAll() {
    await notificationsApi.readAll(t);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Workflow alerts, receipts, results, stock risk, claims, and discharge updates"
        action={
          <div className="flex gap-2">
            <Link href="/settings/notifications">
              <Button variant="ghost" icon={Filter}>
                Preferences
              </Button>
            </Link>
            <Button variant="dark" icon={CheckCheck} onClick={readAll}>
              Mark all read
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <HelpTip title="Notification handling">
          Reading or archiving clears the message from your inbox, but it does not resolve the underlying workflow item.
          Use Open when a notification points to a bill, lab result, claim, stock risk, or patient workflow.
        </HelpTip>

        <Section title="Filters">
          <div className="grid gap-4 p-5 md:grid-cols-4">
            <FormField label="Read state">
              <Select value={read} onChange={(e) => setRead(e.target.value)}>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
                <option value="all">All active</option>
              </Select>
            </FormField>
            <FormField label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Severity">
              <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="">All severities</option>
                {NOTIFICATION_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="flex items-end">
              <Button variant="ghost" onClick={load} className="w-full">
                Refresh
              </Button>
            </div>
          </div>
        </Section>

        {err && <ErrorState message={err} />}
        {loading ? (
          <Spinner label="Loading notifications..." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications found"
            hint="Notifications appear here from real workflow events in this tenant."
          />
        ) : (
          <Section title={`${rows.length} notification${rows.length === 1 ? '' : 's'}`}>
            <div className="divide-y divide-line">
              {rows.map((row) => (
                <NotificationRow key={row.id} row={row} onChanged={load} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <Protected>
      <NotificationsInner />
    </Protected>
  );
}
