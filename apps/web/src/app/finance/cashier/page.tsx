'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { outstanding, PAYMENT_METHODS, type Bill } from '@/lib/billing';
import { financeApi } from '@/lib/finance';
import { money } from '@/lib/format';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Section,
  Select,
  Spinner,
  StatusChip,
} from '@/components/ui';
import { BillTable, FinanceShell, FINANCE_PERMS } from '../finance-ui';

function CashierInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [rows, setRows] = useState<Bill[] | null>(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [payBill, setPayBill] = useState<Bill | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = { status: 'UNPAID' };
      if (q.trim()) params.q = q.trim();
      const unpaid = await financeApi.bills(t, params);
      const partial = await financeApi.bills(t, { ...(q.trim() ? { q: q.trim() } : {}), status: 'PARTIAL' });
      setRows([...unpaid, ...partial]);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [q, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Cashier" subtitle="Search patient bills, collect payment, and print receipt" />
      <FinanceShell>
        <div className="space-y-6">
          {err && <ErrorState message={err} />}
          <Section title="Find bill">
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search bill number, patient, or MRN"
              />
              <Button variant="ghost" onClick={load}>
                Search
              </Button>
            </div>
          </Section>
          {!rows ? (
            <Spinner label="Loading cashier queue..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No unpaid or partial bills"
              hint="Bills from pending charges, OPD, pharmacy, IPD, or manual billing appear here when unpaid."
            />
          ) : (
            <Section title="Open bills">
              <BillTable bills={rows} />
              <div className="border-t border-line p-5">
                <Select
                  value={payBill?.id ?? ''}
                  onChange={(e) => setPayBill(rows.find((b) => b.id === e.target.value) ?? null)}
                >
                  <option value="">Collect payment for bill...</option>
                  {rows.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {bill.billNumber} - {bill.patient?.fullName ?? 'Patient'} - {money(outstanding(bill))}
                    </option>
                  ))}
                </Select>
              </div>
            </Section>
          )}
        </div>
      </FinanceShell>
      <PaymentModal bill={payBill} onClose={() => setPayBill(null)} onSaved={load} />
    </>
  );
}

function PaymentModal({
  bill,
  onClose,
  onSaved,
}: {
  bill: Bill | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (bill) {
      setAmount(String(outstanding(bill) / 100));
      setMethod('CASH');
      setTransactionId('');
    }
  }, [bill]);

  async function submit() {
    if (!activeTenantId || !bill) return;
    setBusy(true);
    try {
      await financeApi.pay(activeTenantId, bill.id, {
        amount: Math.round(Number(amount) * 100),
        method,
        transactionId: transactionId.trim() || undefined,
      });
      toast.success('Payment collected.');
      await onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!bill}
      onClose={onClose}
      title="Collect payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!bill || Number(amount) <= 0}>
            Collect
          </Button>
        </>
      }
    >
      {bill && (
        <div className="space-y-4">
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-body-sm">
            <div className="flex items-center justify-between">
              <Link href={`/finance/bills/${bill.id}`} className="font-mono text-primary">
                {bill.billNumber}
              </Link>
              <StatusChip status={bill.status} />
            </div>
            <div className="mt-1 text-ink-muted">Outstanding {money(outstanding(bill))}</div>
          </div>
          <FormField label="Amount" required>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <FormField label="Method" required>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Transaction ID">
            <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
          </FormField>
        </div>
      )}
    </Modal>
  );
}

export default function CashierPage() {
  return (
    <Protected requireModule="BILLING" requirePermission={['finance.cashier', 'payment.collect', ...FINANCE_PERMS]}>
      <CashierInner />
    </Protected>
  );
}
