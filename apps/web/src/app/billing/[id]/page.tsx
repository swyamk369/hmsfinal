'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CreditCard, Printer, Ban, RotateCcw, ShieldCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { billingApi, collected, outstanding, PAYMENT_METHODS, type Bill } from '@/lib/billing';
import { money, toMinor, formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  ReasonModal,
  FormField,
  Input,
  Select,
  Textarea,
  PageHeader,
  Spinner,
  ErrorState,
  StatusChip,
} from '@/components/ui';

function BillDetail({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const modules = new Set(getActiveMembership(profile, activeTenantId)?.modules ?? []);
  const has = (p: string) => perms.has(p);

  const [bill, setBill] = useState<Bill | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setBill(await billingApi.get(t, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!bill) return <Spinner label="Loading bill…" />;

  const due = outstanding(bill);
  const paidNet = collected(bill);

  return (
    <>
      <Link
        href="/billing"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to billing
      </Link>

      <PageHeader
        title={bill.billNumber}
        subtitle={bill.patient?.fullName ?? ''}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/billing/${id}/invoice`}>
              <Button variant="ghost" icon={Printer}>
                Invoice
              </Button>
            </Link>
            {has('payment.collect') && bill.status !== 'CANCELLED' && due > 0 && (
              <Button icon={CreditCard} onClick={() => setPayOpen(true)}>
                Collect payment
              </Button>
            )}
            {has('payment.refund') && paidNet > 0 && (
              <Button variant="ghost" icon={RotateCcw} onClick={() => setRefundOpen(true)}>
                Refund
              </Button>
            )}
            {has('bill.cancel') && bill.status !== 'CANCELLED' && paidNet === 0 && (
              <Button variant="danger" icon={Ban} onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusChip status={bill.status} />
        {bill.cancellationReason && (
          <span className="text-body-sm text-ink-soft">Cancelled: {bill.cancellationReason}</span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Line items">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bill.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-5 py-2.5 text-ink">{it.name}</td>
                    <td className="px-3 py-2.5 text-right text-ink-muted">{it.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-ink-muted">{money(it.unitPrice)}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-ink">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Payment history">
            {bill.payments.length === 0 && bill.refunds.length === 0 ? (
              <p className="px-5 py-6 text-body-sm text-ink-soft">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {bill.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-body-sm">
                    <span className="text-ink">
                      Payment · {p.method}
                      {p.transactionId ? ` · ${p.transactionId}` : ''}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-success-fg">+{money(p.amount)}</span>
                      <span className="text-label-sm text-ink-soft">{formatDateTime(p.createdAt)}</span>
                    </span>
                  </li>
                ))}
                {bill.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3 text-body-sm">
                    <span className="text-ink">Refund · {r.reason}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-danger-fg">−{money(r.amount)}</span>
                      <span className="text-label-sm text-ink-soft">{formatDateTime(r.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {modules.has('INSURANCE') && has('insurance.read') && (
            <Section
              title="Insurance claims"
              action={
                has('insurance.claim.create') && bill.status !== 'CANCELLED' ? (
                  <Link href={`/insurance?billId=${bill.id}`}>
                    <Button size="sm" variant="ghost" icon={ShieldCheck}>
                      Create claim
                    </Button>
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
                        <th className="px-5 py-2 font-medium">Payer / policy</th>
                        <th className="px-5 py-2 text-right font-medium">Claim</th>
                        <th className="px-5 py-2 text-right font-medium">Approved</th>
                        <th className="px-5 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {bill.claims.map((claim) => (
                        <tr key={claim.id}>
                          <td className="px-5 py-2.5">
                            <Link href={`/insurance/claims/${claim.id}`} className="font-medium text-primary hover:underline">
                              {claim.patientPolicy?.provider?.name ?? 'Insurance'}
                            </Link>
                            <div className="text-label-sm text-ink-soft">{claim.patientPolicy?.policyNumber ?? '—'}</div>
                          </td>
                          <td className="px-5 py-2.5 text-right text-ink-muted">{money(claim.claimAmount)}</td>
                          <td className="px-5 py-2.5 text-right text-ink-muted">
                            {claim.approvedAmount ? money(claim.approvedAmount) : '—'}
                          </td>
                          <td className="px-5 py-2.5">
                            <StatusChip status={claim.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}
        </div>

        <Section title="Summary">
          <div className="space-y-3 px-5 py-4 text-body-sm">
            <Row label="Subtotal" value={money(bill.totalAmount)} />
            <Row label="Discount" value={`− ${money(bill.discount)}`} />
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
      </div>

      <CollectModal
        open={payOpen}
        due={due}
        onClose={() => setPayOpen(false)}
        onConfirm={async (dto) => {
          await billingApi.pay(t, id, dto);
          toast.success('Payment collected.');
          await load();
        }}
      />
      <RefundModal
        open={refundOpen}
        max={paidNet}
        onClose={() => setRefundOpen(false)}
        onConfirm={async (amount, reason) => {
          await billingApi.refund(t, id, amount, reason);
          toast.success('Refund recorded.');
          await load();
        }}
      />
      <ReasonModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel bill"
        description="Cancelling voids this bill. Bills with collected payments must be refunded first."
        confirmLabel="Cancel bill"
        onConfirm={async (reason) => {
          await billingApi.cancel(t, id, reason);
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
  const [amountStr, setAmountStr] = useState('');
  const [method, setMethod] = useState('CASH');
  const [txn, setTxn] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountStr((due / 100).toFixed(2));
      setMethod('CASH');
      setTxn('');
      setNotes('');
    }
  }, [open, due]);

  async function go() {
    const amount = toMinor(amountStr);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      await onConfirm({ amount, method, transactionId: txn.trim() || undefined, notes: notes.trim() || undefined });
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
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy}>
            Confirm payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">
          Balance due: <span className="font-medium text-ink">{money(due)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Amount" required>
            <Input inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Method" required>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Transaction ID / reference">
          <Input value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="Optional for cash" />
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
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmountStr((max / 100).toFixed(2));
      setReason('');
    }
  }, [open, max]);

  async function go() {
    const amount = toMinor(amountStr);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (!reason.trim()) {
      toast.error('A reason is required.');
      return;
    }
    setBusy(true);
    try {
      await onConfirm(amount, reason.trim());
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
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={go} loading={busy} disabled={!reason.trim()}>
            Refund
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">
          Refundable: <span className="font-medium text-ink">{money(max)}</span>
        </div>
        <FormField label="Amount" required>
          <Input inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} autoFocus />
        </FormField>
        <FormField label="Reason" required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Document why this refund is being issued…"
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default function BillDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="BILLING" allowedRoles={['BILLING', 'ACCOUNTANT', 'RECEPTION', 'HOSPITAL_ADMIN']}>
      <BillDetail id={params.id} />
    </Protected>
  );
}
