'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Receipt, Search } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { billingApi, type Bill, type BillingStats } from '@/lib/billing';
import { money, formatDate } from '@/lib/format';
import {
  Button,
  Section,
  PageHeader,
  StatCard,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  Input,
  Select,
} from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

function BillingInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [rows, setRows] = useState<Bill[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      if (q.trim()) params.q = q.trim();
      const [s, b] = await Promise.all([billingApi.stats(t), billingApi.list(t, params)]);
      setStats(s);
      setRows(b);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Billing Dashboard"
        subtitle="Bills, payments, and receivables"
        action={
          <Link href="/billing/new">
            <Button icon={Plus}>Create New Bill</Button>
          </Link>
        }
      />

      {err && <ErrorState message={err} />}

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Unpaid bills" value={stats.unpaidCount} />
          <StatCard label="Partial" value={stats.partialCount} />
          <StatCard label="Paid today" value={money(stats.paidToday)} />
          <StatCard label="Outstanding" value={money(stats.outstandingReceivables)} hint="UNPAID + PARTIAL" />
        </div>
      )}

      <div className="mb-6 space-y-6">
        <HelpTip title="Billing flow">
          Prioritize partial and unpaid bills tied to active IPD or completed visits. Refunds and cancellations should
          always carry the reason that belongs in the audit trail.
        </HelpTip>
        <WorkQueuePanel title="Billing work queue" modules={['BILLING', 'INSURANCE']} limit={6} compact />
      </div>

      <Section
        title="Bills"
        action={
          <div className="flex items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <Input
                className="w-44 pl-8"
                placeholder="Bill # or patient"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </form>
            <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </Select>
          </div>
        }
      >
        {!rows ? (
          <Spinner label="Loading bills…" />
        ) : rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={Receipt}
              title="No bills found"
              action={
                <Link href="/billing/new">
                  <Button size="sm" icon={Plus}>
                    Create New Bill
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Bill #</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((b) => (
                  <tr
                    key={b.id}
                    className="cursor-pointer hover:bg-canvas"
                    onClick={() => router.push(`/billing/${b.id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-ink-muted">{b.billNumber}</td>
                    <td className="px-5 py-3 font-medium text-ink">{b.patient?.fullName ?? '—'}</td>
                    <td className="px-5 py-3 text-ink-muted">{formatDate(b.createdAt)}</td>
                    <td className="px-5 py-3 text-right font-medium text-ink">{money(b.netAmount)}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

export default function BillingPage() {
  return (
    <Protected requireModule="BILLING" allowedRoles={['BILLING', 'ACCOUNTANT', 'RECEPTION', 'HOSPITAL_ADMIN']}>
      <BillingInner />
    </Protected>
  );
}
