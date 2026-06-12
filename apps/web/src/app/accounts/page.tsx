'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Banknote, FileText, RefreshCw } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { billingApi, type BillingStats } from '@/lib/billing';
import { insuranceApi, claimApproved, claimSettled, type InsuranceReceivables } from '@/lib/insurance';
import { money, formatDateTime } from '@/lib/format';
import { Button, EmptyState, ErrorState, PageHeader, Section, Spinner, StatCard, StatusChip } from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

function AccountsInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const membership = getActiveMembership(profile, activeTenantId);
  const hasInsurance = Boolean(
    membership?.modules.includes('INSURANCE') && membership?.permissions.includes('insurance.read'),
  );
  const [billing, setBilling] = useState<BillingStats | null>(null);
  const [receivables, setReceivables] = useState<InsuranceReceivables | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const [billStats, insuranceRows] = await Promise.all([
        billingApi.stats(t),
        hasInsurance ? insuranceApi.receivables(t) : Promise.resolve(null),
      ]);
      setBilling(billStats);
      setReceivables(insuranceRows);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, hasInsurance]);

  useEffect(() => {
    void load();
  }, [load]);

  const openClaims = useMemo(
    () =>
      (receivables?.claims ?? []).filter((c) =>
        ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED'].includes(c.status),
      ),
    [receivables],
  );

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Billing receivables, insurance claim receivables, and settlement reconciliation"
        action={
          <Button variant="ghost" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        }
      />

      {err && <ErrorState message={err} />}
      {!billing && !err && <Spinner label="Loading accounts…" />}

      {billing && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Outstanding billing" value={money(billing.outstandingReceivables)} icon={Banknote} />
          <StatCard label="Paid today" value={money(billing.paidToday)} />
          <StatCard label="Unpaid bills" value={billing.unpaidCount} />
          <StatCard label="Partial bills" value={billing.partialCount} />
        </div>
      )}

      {hasInsurance && receivables && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open insurance claims" value={receivables.stats.openClaims} icon={FileText} />
          <StatCard label="Submitted amount" value={money(receivables.stats.submittedAmount)} />
          <StatCard label="Approved outstanding" value={money(receivables.stats.approvedOutstanding)} />
          <StatCard label="Settled today" value={money(receivables.stats.settledToday)} />
        </div>
      )}

      <div className="mb-6 space-y-6">
        <HelpTip title="Accounts flow">
          Reconcile billing receivables first, then insurance approvals and settlements. Use blockers to catch rejected
          claims and high-value balances before month-end.
        </HelpTip>
        <WorkQueuePanel title="Accounts work queue" modules={['BILLING', 'INSURANCE']} limit={6} compact />
      </div>

      {hasInsurance && (
        <Section title="Insurance receivables">
          {!receivables ? (
            <Spinner label="Loading insurance receivables…" />
          ) : openClaims.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState
                title="No open insurance receivables"
                hint="Approved and submitted claims appear here for follow-up."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-3 font-medium">Claim</th>
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium">Payer</th>
                    <th className="px-5 py-3 text-right font-medium">Approved</th>
                    <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {openClaims.map((claim) => {
                    const approved = claimApproved(claim);
                    const settled = claimSettled(claim);
                    return (
                      <tr key={claim.id} className="hover:bg-canvas">
                        <td className="px-5 py-3">
                          <Link
                            href={`/insurance/claims/${claim.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {claim.bill?.billNumber ?? claim.id.slice(0, 8)}
                          </Link>
                          <div className="text-label-sm text-ink-soft">{formatDateTime(claim.createdAt)}</div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink">{claim.bill?.patient?.fullName ?? '—'}</div>
                          <div className="text-label-sm text-ink-soft">{claim.bill?.patient?.mrn ?? '—'}</div>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{claim.patientPolicy?.provider?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-right text-ink-muted">{money(approved)}</td>
                        <td className="px-5 py-3 text-right font-medium text-ink">
                          {money(Math.max(0, approved - settled))}
                        </td>
                        <td className="px-5 py-3">
                          <StatusChip status={claim.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </>
  );
}

export default function AccountsPage() {
  return (
    <Protected
      requireModule="BILLING"
      allowedRoles={['ACCOUNTANT', 'HOSPITAL_ADMIN']}
      requirePermission={['reports.financial.read']}
    >
      <AccountsInner />
    </Protected>
  );
}
