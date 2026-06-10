'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, CreditCard, FileText, ListChecks, ShieldCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { financeApi, type FinanceDashboard } from '@/lib/finance';
import { money, formatDateTime } from '@/lib/format';
import { HelpTip, WorkQueuePanel } from '@/components/operations';
import { Button, EmptyState, ErrorState, PageHeader, Section, Spinner, StatCard, StatusChip } from '@/components/ui';
import { ChargeTable, FinanceQuickActions, FinanceShell, FINANCE_PERMS } from './finance-ui';

function FinanceHome() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [data, setData] = useState<FinanceDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await financeApi.dashboard(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Finance"
        subtitle="Cashier, bills, patient accounts, receivables, day close, approvals, and reports"
        action={<Button variant="ghost" onClick={load}>Refresh</Button>}
      />
      <FinanceShell>
        {err && <ErrorState message={err} />}
        {!data && !err ? (
          <Spinner label="Loading finance dashboard..." />
        ) : data ? (
          <div className="space-y-6">
            <HelpTip title="One finance workspace">
              Reception, billing, accounts, and insurance users work from the same financial layer. The tabs you can use
              depend on tenant permissions, not whether this hospital has a separate accounts department.
            </HelpTip>

            <div className="text-body-sm text-ink-soft">Updated {formatDateTime(data.generatedAt)}</div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Collection today" value={money(data.collectionToday)} icon={CreditCard} hint={`${money(data.refundsToday)} refunded`} />
              <StatCard label="Patient dues" value={money(data.outstandingPatientDues)} icon={Banknote} />
              <StatCard label="Insurance receivables" value={money(data.insuranceReceivables)} icon={ShieldCheck} />
              <StatCard label="Pending charges" value={data.pendingCharges} icon={ListChecks} hint={`${data.unpaidBills + data.partialBills} open bills`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Section title="Finance blockers" className="xl:col-span-2">
                {data.blockers.length === 0 ? (
                  <div className="p-5">
                    <EmptyState title="No finance blockers" hint="Pending charges, unpaid bills, approvals, and day-close gaps appear here." />
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {data.blockers.map((b) => (
                      <Link key={b.type} href={b.href} className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <AlertTriangle className="h-4 w-4 text-warning-fg" />
                          {b.label}
                        </span>
                        <span className="text-body-sm text-primary">Open</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Day close">
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-ink-muted">Status</span>
                    <StatusChip status={data.dayCloseStatus} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm text-ink-muted">Net collection</span>
                    <span className="font-medium text-ink">{money(data.netCollectionToday)}</span>
                  </div>
                  <Link href="/finance/day-close">
                    <Button className="w-full" variant="ghost" icon={FileText}>Review close</Button>
                  </Link>
                </div>
              </Section>
            </div>

            <WorkQueuePanel title="Finance work queue" modules={['BILLING']} limit={6} compact />

            <Section title="Pending charge preview">
              {data.pendingChargeRows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No pending charges" />
                </div>
              ) : (
                <ChargeTable charges={data.pendingChargeRows} />
              )}
            </Section>

            <FinanceQuickActions />
          </div>
        ) : null}
      </FinanceShell>
    </>
  );
}

export default function FinancePage() {
  return (
    <Protected requireModule="BILLING" requirePermission={FINANCE_PERMS}>
      <FinanceHome />
    </Protected>
  );
}
