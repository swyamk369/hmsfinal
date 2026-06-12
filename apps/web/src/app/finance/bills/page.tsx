'use client';

import { useCallback, useEffect, useState } from 'react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { financeApi } from '@/lib/finance';
import type { Bill } from '@/lib/billing';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Section,
  Select,
  Spinner,
} from '@/components/ui';
import { BillTable, FinanceShell, FINANCE_PERMS } from '../finance-ui';

function FinanceBillsInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [rows, setRows] = useState<Bill[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.q = q.trim();
      if (status) params.status = status;
      setRows(await financeApi.bills(t, params));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [q, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle="Unified bills from charges, OPD, pharmacy, IPD, lab, manual services, and insurance"
      />
      <FinanceShell>
        <div className="space-y-6">
          {err && <ErrorState message={err} />}
          <Section title="Filters">
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_180px_auto]">
              <FormField label="Search">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill number, patient, MRN" />
              </FormField>
              <FormField label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  {['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED', 'REFUNDED'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="flex items-end">
                <Button variant="ghost" onClick={load}>
                  Refresh
                </Button>
              </div>
            </div>
          </Section>
          {!rows ? (
            <Spinner label="Loading bills..." />
          ) : rows.length === 0 ? (
            <EmptyState title="No bills found" />
          ) : (
            <Section title={`${rows.length} bill${rows.length === 1 ? '' : 's'}`}>
              <BillTable bills={rows} />
            </Section>
          )}
        </div>
      </FinanceShell>
    </>
  );
}

export default function FinanceBillsPage() {
  return (
    <Protected requireModule="BILLING" requirePermission={FINANCE_PERMS}>
      <FinanceBillsInner />
    </Protected>
  );
}
