'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Banknote, CreditCard, ListChecks, ShieldCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { financeApi, type FinanceDashboard } from '@/lib/finance';
import { formatDateTime, money } from '@/lib/format';
import { Button, EmptyState, ErrorState, PageHeader, Section, Spinner, StatCard } from '@/components/ui';
import { FinanceShell, FINANCE_PERMS } from '../finance-ui';

interface FinanceReportSummary {
  generatedAt: string;
  dashboard: FinanceDashboard;
  insuranceReceivableCount: number;
}

function FinanceReportsInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [data, setData] = useState<FinanceReportSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await financeApi.reportSummary(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const dashboard = data?.dashboard;

  return (
    <>
      <PageHeader
        title="Finance Reports"
        subtitle={
          data ? `Unified finance summary · ${formatDateTime(data.generatedAt)}` : 'Unified revenue-cycle summary'
        }
        action={
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />
      <FinanceShell>
        {err && <ErrorState message={err} />}
        {!data || !dashboard ? (
          !err && <Spinner label="Loading finance reports..." />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Collection today" value={money(dashboard.collectionToday)} icon={CreditCard} />
              <StatCard label="Net collection" value={money(dashboard.netCollectionToday)} icon={Banknote} />
              <StatCard label="Patient dues" value={money(dashboard.outstandingPatientDues)} />
              <StatCard
                label="Insurance receivables"
                value={money(dashboard.insuranceReceivables)}
                icon={ShieldCheck}
                hint={`${data.insuranceReceivableCount} claims`}
              />
              <StatCard label="Pending charges" value={dashboard.pendingCharges} icon={ListChecks} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Breakdown title="Payment method split" rows={dashboard.paymentMethodSplit} />
              <Breakdown title="Module revenue today" rows={dashboard.moduleRevenue} />
            </div>

            <Section title="Finance blockers">
              {dashboard.blockers.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No finance blockers" />
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {dashboard.blockers.map((blocker) => (
                    <Link
                      key={blocker.type}
                      href={blocker.href}
                      className="flex items-center justify-between px-5 py-3 hover:bg-canvas"
                    >
                      <span className="font-medium text-ink">{blocker.label}</span>
                      <span className="text-body-sm text-primary">Open</span>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Export-ready report areas">
              <div className="grid gap-3 p-5 md:grid-cols-3">
                <ReportLink href="/reports/financial" label="Financial reports" />
                <ReportLink href="/finance/payments" label="Payment ledger" />
                <ReportLink href="/finance/insurance-receivables" label="Insurance receivables" />
              </div>
            </Section>
          </div>
        )}
      </FinanceShell>
    </>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows ?? {});
  return (
    <Section title={title}>
      {entries.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No data yet" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map(([key, value]) => (
            <li key={key} className="flex items-center justify-between px-5 py-3 text-body-sm">
              <span className="font-medium text-ink">{key.replace(/_/g, ' ')}</span>
              <span className="text-ink-muted">{money(value)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ReportLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-line px-3 py-3 text-body-sm hover:border-primary hover:text-primary"
    >
      <span className="flex items-center gap-2 font-medium">
        <BarChart3 className="h-4 w-4" />
        {label}
      </span>
      <span>Open</span>
    </Link>
  );
}

export default function FinanceReportsPage() {
  return (
    <Protected
      requireModule="BILLING"
      requirePermission={['reports.financial.read', 'finance.reconcile', ...FINANCE_PERMS]}
    >
      <FinanceReportsInner />
    </Protected>
  );
}
