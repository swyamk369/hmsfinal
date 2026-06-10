'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, CreditCard, Printer, RotateCcw, ShieldCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import { getActiveMembership } from '@/lib/access';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { collected, outstanding, PAYMENT_METHODS, type Bill } from '@/lib/billing';
import { financeApi } from '@/lib/finance';
import { formatDateTime, money, toMinor } from '@/lib/format';
import {
  Button,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  ReasonModal,
  Section,
  Select,
  Spinner,
  StatusChip,
  Textarea,
} from '@/components/ui';
import { FinanceShell, FINANCE_PERMS } from '../../finance-ui';

function BillDetail({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const permissions = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const modules = new Set(getActiveMembership(profile, activeTenantId)?.modules ?? []);
  const has = (p: string) => permissions.has(p);

  const [bill, setBill] = useState<Bill | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setBill(await financeApi.bill(t, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!bill) return <Spinner label="Loading finance bill..." />;

  const due = outstanding(bill);
  const paidNet = collected(bill);

  return (
    <>
      <Link href="/finance/bills" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to bills
      </Link>
      <PageHeader
        title={bill.billNumber}
        subtitle={`${bill.patient?.fullName ?? 'Patient'} · ${formatDateTime(bill.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/billing/${bill.id}/invoice`}>
              <Button variant="ghost" icon={Printer}>Invoice</Button>
            </Link>
            {has('payment.collect') && bill.status !== 'CANCELLED' && due > 0 && (
              <Button icon={CreditCard} onClick={() => setPayOpen(true)}>Collect payment</Button>
            )}
            {has('payment.refund') && paidNet > 0 && (
              <Button variant="ghost" icon={RotateCcw} onClick={() => setRefundOpen(true)}>Refund</Button>
            )}
            {has('bill.cancel') && bill.status !== 'CANCELLED' && paidNet === 0 && (
              <Button variant="danger" icon={Ban} onClick={() => setCancelOpen(true)}>Cancel</Button>
            )}
          </div>
        }
      />
      <FinanceShell>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StatusChip status={bill.status} />
          {bill.cancellationReason && <span className="text-body-sm text-ink-soft">Cancelled: {bill.cancellationReason}</span>}
          <Link href={`/finance/patient-accounts/${bill.patientId}`} className="text-body-sm font-medium text-primary hover:underline">
            Open patient account
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Section title="Line items">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                      <th className="px-5 py-3 font-medium">Service</th>
                      <th className="px-3 py-3 text-right font-medium">Qty</th>
                      <th className="px-3 py-3 text-right font-medium">Unit</th>
                      <th className="px-5 py-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {bill.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink">{item.name}</div>
                          <div className="text-label-sm text-ink-soft">{item.sourceType.replace(/_/g, ' ')}</div>
                        </td>
                        <td className="px-3 py-3 text-right text-ink-muted">{item.quantity}</td>
                        <td className="px-3 py-3 text-right text-ink-muted">{money(item.unitPrice)}</td>
                        <td className="px-5 py-3 text-right font-medium text-ink">{money(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Payments and refunds">
              {bill.payments.length === 0 && bill.refunds.length === 0 ? (
                <p className="px-5 py-6 text-body-sm text-ink-soft">No payment activity yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {bill.payments.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 px-5 py-3 text-body-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-ink">Payment · {p.method.replace(/_/g, ' ')}{p.transactionId ? ` · ${p.transactionId}` : ''}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium text-success-fg">+{money(p.amount)}</span>
                        <span className="text-label-sm text-ink-soft">{formatDateTime(p.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                  {bill.refunds.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 px-5 py-3 text-body-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-ink">Refund · {r.reason}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium text-danger-fg">-{money(r.amount)}</span>
                        <span className="text-label-sm text-ink-soft">{formatDateTime(r.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {modules.has('INSURANCE') && (
              <Section
                title="Insurance"
                action={
                  has('insurance.claim.create') && bill.status !== 'CANCELLED' ? (
                    <Link href={`/insurance?billId=${bill.id}`}>
                      <Button size="sm" variant="ghost" icon={ShieldCheck}>Create claim</Button>
                    </Link>
                  ) : undefined
                }
              >
                {!bill.claims || bill.claims.length === 0 ? (
                  <p className="px-5 py-6 text-body-sm text-ink-soft">No insurance claim linked to this bill.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-body-sm">
                      <thead>
                        <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                          <th className="px-5 py-3 font-medium">Claim</th>
                          <th className="px-5 py-3 text-right font-medium">Claimed</th>
                          <th className="px-5 py-3 text-right font-medium">Approved</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {bill.claims.map((claim) => (
                          <tr key={claim.id}>
                            <td className="px-5 py-3">
                              <Link href={`/insurance/claims/${claim.id}`} className="font-medium text-primary hover:underline">
                                {claim.patientPolicy?.provider?.name ?? 'Insurance claim'}
                              </Link>
                              <div className="text-label-sm text-ink-soft">{claim.patientPolicy?.policyNumber ?? 'No policy number'}</div>
                            </td>
                            <td className="px-5 py-3 text-right text-ink-muted">{money(claim.claimAmount)}</td>
                            <td className="px-5 py-3 text-right text-ink-muted">{claim.approvedAmount ? money(claim.approvedAmount) : '-'}</td>
                            <td className="px-5 py-3"><StatusChip status={claim.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            )}
          </div>

          <div className="space-y-6">
            <Section title="Bill summary">
              <div className="space-y-3 px-5 py-4 text-body-sm">
                <Row label="Subtotal" value={money(bill.totalAmount)} />
                <Row label="Discount" value={`- ${money(bill.discount)}`} />
                <div className="flex justify-between border-t border-line pt-3 font-medium text-ink">
                  <span>Net amount</span>
                  <span>{money(bill.netAmount)}</span>
                </div>
                <Row label="Collected" value={money(paidNet)} />
                <div className="flex justify-between rounded-md bg-canvas px-3 py-2 text-title-lg text-ink">
                  <span>Balance due</span>
                  <span>{money(due)}</span>
                </div>
              </div>
            </Section>
            <Section title="Audit-sensitive actions">
              <div className="space-y-2 p-5 text-body-sm text-ink-muted">
                <p>Refunds, cancellations, and charge reversals require a reason and are written to the audit trail.</p>
                <p>Use approvals for high-value exceptions or day-close reopening.</p>
              </div>
            </Section>
          </div>
        </div>
      </FinanceShell>

      <CollectModal
        open={payOpen}
        due={due}
        onClose={() => setPayOpen(false)}
        onConfirm={async (dto) => {
          await financeApi.pay(t, id, dto);
          toast.success('Payment collected.');
          await load();
        }}
      />
      <RefundModal
        open={refundOpen}
        max={paidNet}
        onClose={() => setRefundOpen(false)}
        onConfirm={async (amount, reason) => {
          await financeApi.refund(t, id, amount, reason);
          toast.success('Refund recorded.');
          await load();
        }}
      />
      <ReasonModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel bill"
        description="Cancelling a bill is audit-sensitive. Bills with collected payments must be refunded first."
        confirmLabel="Cancel bill"
        onConfirm={async (reason) => {
          await financeApi.cancelBill(t, id, reason);
          toast.success('Bill cancelled.');
          await load();
        }}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function CollectModal({
  open,
  due,
  onClose,
  onConfirm,
}: {
  open: boolean;
  due: number;
  onClose: () => void;
  onConfirm: (dto: { amount: number; method: string; transactionId?: string; notes?: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount((due / 100).toFixed(2));
      setMethod('CASH');
      setTransactionId('');
      setNotes('');
    }
  }, [due, open]);

  async function submit() {
    const parsed = toMinor(amount);
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      await onConfirm({ amount: parsed, method, transactionId: transactionId.trim() || undefined, notes: notes.trim() || undefined });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Collect payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Collect</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">Balance due: <span className="font-medium text-ink">{money(due)}</span></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Amount" required>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Method" required>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Transaction ID / reference">
          <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

function RefundModal({
  open,
  max,
  onClose,
  onConfirm,
}: {
  open: boolean;
  max: number;
  onClose: () => void;
  onConfirm: (amount: number, reason: string) => Promise<void>;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount((max / 100).toFixed(2));
      setReason('');
    }
  }, [max, open]);

  async function submit() {
    const parsed = toMinor(amount);
    if (!parsed || parsed <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (!reason.trim()) {
      toast.error('A reason is required.');
      return;
    }
    setBusy(true);
    try {
      await onConfirm(parsed, reason.trim());
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refund payment"
      danger
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason.trim()}>Refund</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">Refundable: <span className="font-medium text-ink">{money(max)}</span></div>
        <FormField label="Amount" required>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </FormField>
        <FormField label="Reason" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export default function FinanceBillDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="BILLING" requirePermission={FINANCE_PERMS}>
      <BillDetail id={params.id} />
    </Protected>
  );
}
