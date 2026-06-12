'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { financeApi, type FinancePaymentRow } from '@/lib/finance';
import { formatDateTime, money } from '@/lib/format';
import { Button, EmptyState, ErrorState, FormField, Input, PageHeader, Section, Spinner } from '@/components/ui';
import { FinanceShell, FINANCE_PERMS } from '../finance-ui';

function PaymentsPageInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [rows, setRows] = useState<FinancePaymentRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      setRows(await financeApi.payments(t, params));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [endDate, startDate, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Collection ledger for cashier and finance reconciliation"
        action={
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />
      <FinanceShell>
        <div className="space-y-6">
          <Section title="Filters">
            <div className="grid gap-4 p-5 md:grid-cols-[220px_220px_auto]">
              <FormField label="Start date">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </FormField>
              <FormField label="End date">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </FormField>
              <div className="flex items-end">
                <Button variant="dark" onClick={load}>
                  Apply
                </Button>
              </div>
            </div>
          </Section>
          {err && <ErrorState message={err} />}
          {!rows ? (
            <Spinner label="Loading payments..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payments found"
              hint="Collections appear here as soon as cashier or reception records payment."
            />
          ) : (
            <Section title={`${rows.length} payment${rows.length === 1 ? '' : 's'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                      <th className="px-5 py-3 font-medium">Bill</th>
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Method</th>
                      <th className="px-5 py-3 text-right font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-canvas">
                        <td className="px-5 py-3">
                          {row.bill ? (
                            <Link
                              href={`/finance/bills/${row.bill.id}`}
                              className="font-mono text-primary hover:underline"
                            >
                              {row.bill.billNumber}
                            </Link>
                          ) : (
                            <span className="text-ink-muted">-</span>
                          )}
                          {row.transactionId && <div className="text-label-sm text-ink-soft">{row.transactionId}</div>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink">{row.bill?.patient?.fullName ?? 'Patient'}</div>
                          <div className="text-label-sm text-ink-soft">{row.bill?.patient?.mrn ?? ''}</div>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{row.method.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3 text-right font-medium text-success-fg">{money(row.amount)}</td>
                        <td className="px-5 py-3 text-ink-muted">{formatDateTime(row.createdAt)}</td>
                      </tr>
                    ))}
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

export default function PaymentsPage() {
  return (
    <Protected
      requireModule="BILLING"
      requirePermission={['finance.read', 'finance.reconcile', 'reports.financial.read', ...FINANCE_PERMS]}
    >
      <PaymentsPageInner />
    </Protected>
  );
}
