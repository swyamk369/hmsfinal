'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, IndianRupee } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { financeApi, type LeakageCategory, type LeakageReport } from '@/lib/finance';
import { ipdApi } from '@/lib/ipd';
import { formatDateTime, money } from '@/lib/format';
import { useToast } from '@/components/toast';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Section, Spinner, StatCard } from '@/components/ui';
import { FinanceShell, FINANCE_PERMS } from '../finance-ui';

function LeakageTable({ category, canAccrue, onAccrued }: { category: LeakageCategory; canAccrue: boolean; onAccrued: () => Promise<void> }) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function accrue(admissionId: string) {
    if (!activeTenantId) return;
    setBusy(admissionId);
    try {
      const res = await ipdApi.accrueBedCharges(activeTenantId, admissionId);
      toast.success(res.posted ? `Posted ${res.plan.totalUnits} bed-day(s).` : 'No new bed days to charge.');
      await onAccrued();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title={`${category.label} (${category.count})`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Issue</th>
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-5 py-3 text-right font-medium">Est. value</th>
              <th className="px-5 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {category.rows.map((row) => (
              <tr key={category.key + row.sourceId} className="hover:bg-canvas">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{row.patient?.fullName ?? 'Patient'}</div>
                  <div className="text-label-sm text-ink-soft">{row.patient?.mrn ?? row.patientId}</div>
                </td>
                <td className="px-5 py-3 text-ink-muted">{row.label}</td>
                <td className="px-5 py-3 text-ink-soft">{formatDateTime(row.occurredAt)}</td>
                <td className="px-5 py-3 text-right font-medium text-ink">{row.estimated != null ? money(row.estimated) : '—'}</td>
                <td className="px-5 py-3 text-right">
                  {category.actionable && canAccrue && row.admissionId ? (
                    <Button size="sm" variant="ghost" loading={busy === row.admissionId} onClick={() => accrue(row.admissionId!)}>
                      Accrue
                    </Button>
                  ) : (
                    <Link href={row.href} className="inline-flex items-center gap-1 text-body-sm font-medium text-primary hover:underline">
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function RevenueLeakageInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const [report, setReport] = useState<LeakageReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canAccrue = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []).has('ipd.charge.write');

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setReport(await financeApi.leakage(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const nonEmpty = report?.categories.filter((c) => c.count > 0) ?? [];

  return (
    <>
      <PageHeader
        title="Revenue Leakage"
        subtitle="Clinical events that should have been billed but weren't — the #1 source of lost hospital revenue"
        action={<Button variant="ghost" onClick={load}>Refresh</Button>}
      />
      <FinanceShell>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Open issues" value={report?.totalCount ?? '—'} icon={AlertTriangle} />
            <StatCard label="Est. recoverable" value={report ? money(report.estimatedRecoverable) : '—'} icon={IndianRupee} hint="Bed-day estimates only" />
            <StatCard label="Categories affected" value={nonEmpty.length} />
            <StatCard label="Last scanned" value={report ? formatDateTime(report.generatedAt) : '—'} />
          </div>
          {err && <ErrorState message={err} />}
          {!report ? (
            <Spinner label="Scanning for unbilled clinical events..." />
          ) : nonEmpty.length === 0 ? (
            <EmptyState title="No revenue leakage detected" hint="Every completed lab order, dispense, consultation, and admitted bed-day has a matching charge." />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {nonEmpty.map((c) => (
                  <Badge key={c.key} tone="warning">
                    {c.label}: {c.count}
                  </Badge>
                ))}
              </div>
              {nonEmpty.map((c) => (
                <LeakageTable key={c.key} category={c} canAccrue={canAccrue} onAccrued={load} />
              ))}
            </>
          )}
        </div>
      </FinanceShell>
    </>
  );
}

export default function RevenueLeakagePage() {
  return (
    <Protected requireModule="BILLING" requirePermission={FINANCE_PERMS}>
      <RevenueLeakageInner />
    </Protected>
  );
}
