'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ListChecks } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { operationsApi, type WorkItem, type WorkPriority } from '@/lib/operations';
import { formatDateTime } from '@/lib/format';
import { Badge, ErrorState, Section, Spinner, cx } from './ui';

const priorityTone: Record<WorkPriority, 'slate' | 'primary' | 'warning' | 'danger'> = {
  LOW: 'slate',
  NORMAL: 'primary',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

export function HelpTip({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('rounded-md border border-primary-100 bg-primary-50/70 px-3 py-2 text-body-sm', className)}>
      <div className="flex gap-2">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-700" />
        <div>
          <div className="font-medium text-primary-700">{title}</div>
          <div className="mt-0.5 text-ink-muted">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function EmptyGuidance({
  title = 'Nothing waiting right now',
  hint = 'When a real workflow needs attention, it will appear here with the next action.',
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <div className="grid place-items-center px-5 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-success-bg text-success-fg">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <div className="text-title-lg text-ink">{title}</div>
      <div className="mt-1 max-w-md text-body-sm text-ink-soft">{hint}</div>
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: WorkPriority }) {
  return <Badge tone={priorityTone[priority]}>{priority}</Badge>;
}

export function NextActionButton({ href, label = 'Open' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-label-sm font-medium text-ink-muted hover:border-primary hover:text-primary"
    >
      {label} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function WorkItemCard({ item }: { item: WorkItem }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={item.priority} />
            <Badge>{item.module}</Badge>
            <span className="text-label-sm uppercase text-ink-soft">{item.status.replace(/_/g, ' ')}</span>
          </div>
          <div className="mt-2 font-medium text-ink">{item.title}</div>
          <div className="mt-0.5 text-body-sm text-ink-muted">{item.subtitle}</div>
          <div className="mt-1 text-label-sm text-ink-soft">{formatDateTime(item.createdAt)}</div>
        </div>
        <NextActionButton href={item.actionHref} />
      </div>
      {(item.blocker || item.help) && (
        <div className="mt-3 rounded-md bg-canvas px-3 py-2 text-body-sm">
          {item.blocker ? (
            <div className="flex gap-2 text-warning-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{item.blocker}</span>
            </div>
          ) : (
            <div className="text-ink-soft">{item.help}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function BlockerCard({ item }: { item: WorkItem }) {
  return (
    <div className="rounded-md border border-warning/30 bg-warning-bg px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-body-sm font-medium text-warning-fg">{item.title}</div>
          <div className="mt-0.5 text-body-sm text-ink-muted">{item.blocker || item.subtitle}</div>
        </div>
        <NextActionButton href={item.actionHref} label="Resolve" />
      </div>
    </div>
  );
}

export function WorkQueuePanel({
  title = 'Work queue',
  hint = 'Live work items from enabled modules, filtered by your role and permissions.',
  modules,
  types,
  limit = 8,
  compact,
}: {
  title?: string;
  hint?: string;
  modules?: string[];
  types?: string[];
  limit?: number;
  compact?: boolean;
}) {
  const { activeTenantId } = useAuth();
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      const queue = await operationsApi.workQueue(activeTenantId);
      setItems(queue.items);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const moduleSet = new Set(modules ?? []);
    const typeSet = new Set(types ?? []);
    return (items ?? [])
      .filter((item) => (moduleSet.size ? moduleSet.has(item.module) : true))
      .filter((item) => (typeSet.size ? typeSet.has(item.type) : true))
      .slice(0, limit);
  }, [items, limit, modules, types]);

  return (
    <Section
      title={title}
      action={
        <button className="text-body-sm font-medium text-primary hover:underline" onClick={load}>
          Refresh
        </button>
      }
    >
      <div className="space-y-4 p-5">
        <HelpTip title="How to read this">{hint}</HelpTip>
        {err && <ErrorState message={err} />}
        {!items && !err ? (
          <Spinner label="Loading work queue..." />
        ) : filtered.length === 0 ? (
          <EmptyGuidance />
        ) : (
          <div className={cx('grid gap-3', !compact && 'xl:grid-cols-2')}>
            {filtered.map((item) => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

export function BlockersPanel({ limit = 5 }: { limit?: number }) {
  const { activeTenantId } = useAuth();
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    operationsApi
      .blockers(activeTenantId)
      .then((res) => setItems(res.items.slice(0, limit)))
      .catch((e) => setErr((e as Error).message));
  }, [activeTenantId, limit]);

  if (err) return <ErrorState message={err} />;
  if (!items) return <Spinner label="Loading blockers..." />;
  if (items.length === 0)
    return <EmptyGuidance title="No blockers" hint="Critical delays and blocked workflow items will appear here." />;

  return (
    <Section title="Blockers">
      <div className="space-y-3 p-5">
        {items.map((item) => (
          <BlockerCard key={item.id} item={item} />
        ))}
      </div>
    </Section>
  );
}
