'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, CheckCircle2, MessageSquare, Clock, ArrowRight } from 'lucide-react';
import Protected from '@/components/Protected';
import { formatDateTime } from '@/lib/format';
import {
  Button,
  Card,
  Input,
  Select,
  PageHeader,
  StatCard,
  StatusChip,
  Badge,
  SkeletonTable,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { supportApi, type SupportTicket } from '@/lib/support-api';

function SupportDashboard() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function load() {
    setErr(null);
    try {
      setTickets(await supportApi.listTickets());
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (q && !`${t.title} ${t.description} ${t.tenantId ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tickets, q, statusFilter]);

  const stats = useMemo(() => {
    const list = tickets ?? [];
    return {
      total: list.length,
      open: list.filter((t) => t.status === 'OPEN').length,
      inProgress: list.filter((t) => t.status === 'IN_PROGRESS').length,
      resolved: list.filter((t) => t.status === 'RESOLVED').length,
    };
  }, [tickets]);

  return (
    <>
      <PageHeader
        title="Global Support Center"
        subtitle="Manage hospital support tickets, fix issues, and assist tenants."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Tickets" value={stats.total} icon={MessageSquare} />
        <StatCard label="Open" value={stats.open} icon={ShieldAlert} />
        <StatCard label="In Progress" value={stats.inProgress} icon={Clock} />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Input className="w-full" placeholder="Search tickets…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </Select>
        </div>

        {err && (
          <div className="p-4">
            <ErrorState message={err} />
          </div>
        )}
        {!err && tickets === null && <SkeletonTable rows={5} cols={5} />}
        {!err && tickets && filtered.length === 0 && (
          <EmptyState
            title={tickets.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}
            hint="You're all caught up!"
          />
        )}

        {filtered.length > 0 && (
          <table className="w-full text-body-sm">
            <thead className="text-left text-label-md uppercase text-ink-soft">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-semibold">Subject / ID</th>
                <th className="px-4 py-2.5 font-semibold">Tenant ID</th>
                <th className="px-4 py-2.5 font-semibold">Priority</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Created</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-canvas"
                  onClick={() => router.push(`/platform/support/${t.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink truncate max-w-xs">{t.title}</div>
                    <div className="font-mono text-label-sm text-ink-soft">{t.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-label-sm text-ink-soft">{t.tenantId || 'Global'}</td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        t.priority === 'URGENT' || t.priority === 'HIGH'
                          ? 'danger'
                          : t.priority === 'MEDIUM'
                            ? 'warning'
                            : 'slate'
                      }
                    >
                      {t.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-ink-soft">{formatDateTime(t.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/support/${t.id}`}
                      className="inline-flex text-ink-soft hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

export default function PlatformSupportPage() {
  return (
    <Protected requirePlatform allowSupport>
      <SupportDashboard />
    </Protected>
  );
}
