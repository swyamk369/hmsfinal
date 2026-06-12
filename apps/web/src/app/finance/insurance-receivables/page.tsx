'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { financeApi } from '@/lib/finance';
import { formatDateTime, money } from '@/lib/format';
import { Button, EmptyState, ErrorState, PageHeader, Section, Spinner, StatCard, StatusChip } from '@/components/ui';
import { FinanceShell, FINANCE_PERMS } from '../finance-ui';

function approvedAmount(claim: any): number {
  return claim.approvedAmount ?? 0;
}

function settledAmount(claim: any): number {
  return (claim.settlements ?? []).reduce((sum: number, row: any) => sum + row.amount, 0);
}

function InsuranceReceivablesInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await financeApi.insuranceReceivables(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const claims = rows ?? [];
    const approved = claims.reduce((sum, c) => sum + approvedAmount(c), 0);
    const settled = claims.reduce((sum, c) => sum + settledAmount(c), 0);
    const rejected = claims.filter((c) => c.status === 'REJECTED').length;
    return { count: claims.length, approved, settled, outstanding: Math.max(0, approved - settled), rejected };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Insurance Receivables"
        subtitle="Approved, submitted, rejected, and unsettled claim money"
        action={
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />
      <FinanceShell>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Open claims" value={stats.count} icon={ShieldCheck} />
            <StatCard label="Approved" value={money(stats.approved)} />
            <StatCard label="Settled" value={money(stats.settled)} />
            <StatCard label="Outstanding" value={money(stats.outstanding)} hint={`${stats.rejected} rejected`} />
          </div>
          {err && <ErrorState message={err} />}
          {!rows ? (
            <Spinner label="Loading insurance receivables..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No open insurance receivables"
              hint="Approved-but-unsettled and submitted claims appear here for follow-up."
            />
          ) : (
            <Section title="Receivable claims">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                      <th className="px-5 py-3 font-medium">Claim / bill</th>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Payer</th>
                      <th className="px-5 py-3 text-right font-medium">Approved</th>
                      <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((claim) => {
                      const approved = approvedAmount(claim);
                      const settled = settledAmount(claim);
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
                            <Link
                              href={`/finance/patient-accounts/${claim.bill?.patientId}`}
                              className="font-medium text-ink hover:text-primary"
                            >
                              {claim.bill?.patient?.fullName ?? 'Patient'}
                            </Link>
                            <div className="text-label-sm text-ink-soft">{claim.bill?.patient?.mrn ?? ''}</div>
                          </td>
                          <td className="px-5 py-3 text-ink-muted">
                            {claim.patientPolicy?.provider?.name ?? 'Insurance'}
                          </td>
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
            </Section>
          )}
        </div>
      </FinanceShell>
    </>
  );
}

export default function InsuranceReceivablesPage() {
  return (
    <Protected
      requireModule="BILLING"
      requirePermission={['insurance.read', 'reports.financial.read', ...FINANCE_PERMS]}
    >
      <InsuranceReceivablesInner />
    </Protected>
  );
}
