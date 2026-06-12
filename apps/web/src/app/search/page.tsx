'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Receipt, Search as SearchIcon, TestTube2, UserRound } from 'lucide-react';
import Protected from '@/components/Protected';
import { getActiveMembership } from '@/lib/access';
import { useAuth } from '@/lib/auth-context';
import { billingApi } from '@/lib/billing';
import { formatDateTime, money } from '@/lib/format';
import { labApi } from '@/lib/lab';
import { patientsApi } from '@/lib/patients';
import { Badge, EmptyState, ErrorState, PageHeader, Section, Spinner, StatusChip } from '@/components/ui';

type SearchResult = {
  id: string;
  type: 'Patient' | 'Bill' | 'Lab';
  title: string;
  subtitle: string;
  href: string;
  status?: string;
  amount?: number;
};

function SearchInner() {
  const params = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const { activeTenantId, profile } = useAuth();
  const membership = getActiveMembership(profile, activeTenantId);
  const permissions = useMemo(() => new Set(membership?.permissions ?? []), [membership]);
  const modules = useMemo(() => new Set(membership?.modules ?? []), [membership]);
  const [rows, setRows] = useState<SearchResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId || !q) {
      setRows([]);
      return;
    }
    const jobs: Array<Promise<SearchResult[]>> = [];

    if (permissions.has('patient.read')) {
      jobs.push(
        patientsApi.list(activeTenantId, q).then((patients) =>
          patients.slice(0, 8).map((p) => ({
            id: `patient:${p.id}`,
            type: 'Patient' as const,
            title: p.fullName,
            subtitle: `${p.mrn}${p.phone ? ` · ${p.phone}` : ''}`,
            href: `/patients/${p.id}`,
          })),
        ),
      );
    }

    if (permissions.has('bill.read') || permissions.has('finance.read')) {
      jobs.push(
        billingApi.list(activeTenantId, { q }).then((bills) =>
          bills.slice(0, 8).map((b) => ({
            id: `bill:${b.id}`,
            type: 'Bill' as const,
            title: b.billNumber,
            subtitle: `${b.patient?.fullName ?? b.patientId} · ${formatDateTime(b.createdAt)}`,
            href: `/finance/bills/${b.id}`,
            status: b.status,
            amount: b.netAmount,
          })),
        ),
      );
    }

    if (modules.has('LAB') && permissions.has('lab.read')) {
      jobs.push(
        labApi.orders(activeTenantId, { q }).then((orders) =>
          orders.slice(0, 8).map((o) => ({
            id: `lab:${o.id}`,
            type: 'Lab' as const,
            title: o.items.map((i) => i.testName).join(', ') || 'Lab order',
            subtitle: `${o.patient?.fullName ?? o.patientId} · ${formatDateTime(o.createdAt)}`,
            href: `/lab/orders/${o.id}`,
            status: o.status,
          })),
        ),
      );
    }

    setErr(null);
    setRows(null);
    const settled = await Promise.allSettled(jobs);
    const fulfilled = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const failed = settled.filter((result) => result.status === 'rejected');
    setRows(fulfilled);
    setErr(failed.length === jobs.length && jobs.length > 0 ? 'Search failed for the records you can access.' : null);
  }, [activeTenantId, modules, permissions, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Search" subtitle={q ? `Results for "${q}"` : 'Find records across your hospital workspace'} />
      {err && <ErrorState message={err} />}
      {!q ? (
        <EmptyState title="Enter a search term" icon={SearchIcon} />
      ) : rows === null ? (
        <Spinner label="Searching..." />
      ) : rows.length === 0 ? (
        <EmptyState title="No matching records" icon={SearchIcon} />
      ) : (
        <Section title={`${rows.length} result${rows.length === 1 ? '' : 's'}`}>
          <div className="divide-y divide-line">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={row.href}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-canvas"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ResultIcon type={row.type} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{row.title}</span>
                      <Badge tone="slate">{row.type}</Badge>
                    </div>
                    <div className="truncate text-body-sm text-ink-muted">{row.subtitle}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {row.amount != null && <span className="font-medium text-ink">{money(row.amount)}</span>}
                  {row.status && <StatusChip status={row.status} />}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function ResultIcon({ type }: { type: SearchResult['type'] }) {
  const Icon = type === 'Patient' ? UserRound : type === 'Bill' ? Receipt : TestTube2;
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-50 text-primary">
      <Icon className="h-4 w-4" />
    </span>
  );
}

export default function SearchPage() {
  return (
    <Protected>
      <Suspense fallback={<Spinner label="Loading search..." />}>
        <SearchInner />
      </Suspense>
    </Protected>
  );
}
