'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, CreditCard, FileSearch, Send, XCircle } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { money, toMinor, formatDate, formatDateTime } from '@/lib/format';
import { outstanding, collected } from '@/lib/billing';
import { claimApproved, claimSettled, insuranceApi, type InsuranceClaim } from '@/lib/insurance';
import {
  Button,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  ReasonModal,
  Section,
  Spinner,
  StatCard,
  StatusChip,
  Textarea,
} from '@/components/ui';

function ClaimDetail({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const canUpdate = perms.has('insurance.claim.update');
  const canApprove = perms.has('insurance.claim.approve');
  const canSettle = perms.has('insurance.claim.settle');

  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setClaim(await insuranceApi.getClaim(t, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const amounts = useMemo(() => {
    if (!claim) return { approved: 0, settled: 0, remaining: 0 };
    const approved = claimApproved(claim);
    const settled = claimSettled(claim);
    return { approved, settled, remaining: Math.max(0, approved - settled) };
  }, [claim]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusyAction(label);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  if (err) return <ErrorState message={err} />;
  if (!claim) return <Spinner label="Loading claim…" />;

  const bill = claim.bill;
  const patient = bill?.patient ?? claim.patientPolicy?.patient;

  return (
    <>
      <Link
        href="/insurance"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to insurance
      </Link>
      <PageHeader
        title={bill?.billNumber ?? `Claim ${claim.id.slice(0, 8)}`}
        subtitle={`${patient?.fullName ?? 'Patient'} · ${claim.patientPolicy?.provider?.name ?? 'Insurance provider'}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canUpdate && claim.status === 'DRAFT' && (
              <Button
                icon={Send}
                loading={busyAction === 'submit'}
                onClick={() =>
                  run('submit', async () => {
                    await insuranceApi.submitClaim(t, claim.id);
                    toast.success('Claim submitted.');
                  })
                }
              >
                Submit
              </Button>
            )}
            {canUpdate && claim.status === 'SUBMITTED' && (
              <Button
                variant="ghost"
                icon={FileSearch}
                loading={busyAction === 'review'}
                onClick={() =>
                  run('review', async () => {
                    await insuranceApi.reviewClaim(t, claim.id);
                    toast.success('Claim marked under review.');
                  })
                }
              >
                Under review
              </Button>
            )}
            {canApprove && ['SUBMITTED', 'UNDER_REVIEW', 'PARTIALLY_APPROVED'].includes(claim.status) && (
              <>
                <Button icon={CheckCircle2} onClick={() => setApproveOpen(true)}>
                  Approve
                </Button>
                <Button variant="danger" icon={XCircle} onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </>
            )}
            {canSettle && ['APPROVED', 'PARTIALLY_APPROVED'].includes(claim.status) && (
              <Button icon={CreditCard} onClick={() => setSettleOpen(true)}>
                Settle
              </Button>
            )}
            {canUpdate && !['SETTLED', 'REJECTED', 'CANCELLED'].includes(claim.status) && (
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChip status={claim.status} />
        {claim.rejectionReason && <span className="text-body-sm text-danger-fg">Reason: {claim.rejectionReason}</span>}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Claim amount" value={money(claim.claimAmount)} />
        <StatCard label="Approved" value={claim.approvedAmount ? money(claim.approvedAmount) : '—'} />
        <StatCard label="Settled" value={money(amounts.settled)} />
        <StatCard label="Patient share" value={claim.patientShare != null ? money(claim.patientShare) : '—'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Bill context">
            <div className="grid gap-4 px-5 py-4 text-body-sm sm:grid-cols-2">
              <Info label="Patient" value={`${patient?.fullName ?? '—'} · ${patient?.mrn ?? '—'}`} />
              <Info label="Bill status" value={bill?.status ? <StatusChip status={bill.status} /> : '—'} />
              <Info label="Net amount" value={bill ? money(bill.netAmount) : '—'} />
              <Info label="Collected" value={bill ? money(collected(bill)) : '—'} />
              <Info label="Balance due" value={bill ? money(outstanding(bill)) : '—'} />
              <Info label="Created" value={formatDateTime(bill?.createdAt)} />
            </div>
            {bill?.items && bill.items.length > 0 && (
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-y border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-2 font-medium">Service</th>
                    <th className="px-5 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {bill.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-2.5 text-ink">{item.name}</td>
                      <td className="px-5 py-2.5 text-right font-medium text-ink">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Settlement history">
            {claim.settlements.length === 0 ? (
              <p className="px-5 py-6 text-body-sm text-ink-soft">No settlement recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {claim.settlements.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3 text-body-sm">
                    <span className="text-ink">
                      Settlement {s.paymentId ? `· payment ${s.paymentId.slice(0, 8)}` : ''}
                      {s.notes ? <span className="text-ink-soft"> · {s.notes}</span> : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-success-fg">{money(s.amount)}</span>
                      <span className="text-label-sm text-ink-soft">{formatDateTime(s.settledAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Policy">
            <div className="space-y-3 px-5 py-4 text-body-sm">
              <Info label="Provider" value={claim.patientPolicy?.provider?.name ?? '—'} />
              <Info label="Policy" value={claim.patientPolicy?.policyNumber ?? '—'} />
              <Info label="Member" value={claim.patientPolicy?.coverage?.memberId ?? '—'} />
              <Info label="Plan" value={claim.patientPolicy?.coverage?.planName ?? '—'} />
              <Info
                label="Validity"
                value={`${formatDate(claim.patientPolicy?.coverage?.validFrom)} - ${formatDate(claim.patientPolicy?.coverage?.validTo)}`}
              />
              <Info
                label="Coverage limit"
                value={claim.patientPolicy?.coverage?.coverageLimit ? money(claim.patientPolicy.coverage.coverageLimit) : '—'}
              />
            </div>
          </Section>

          <Section title="Claim timeline">
            <div className="space-y-3 px-5 py-4 text-body-sm">
              <Info label="Created" value={formatDateTime(claim.createdAt)} />
              <Info label="Submitted" value={formatDateTime(claim.submittedAt)} />
              <Info label="Approved" value={formatDateTime(claim.approvedAt)} />
              <Info label="Settled" value={formatDateTime(claim.settledAt)} />
              <Info label="Remaining" value={money(amounts.remaining)} />
            </div>
          </Section>

          {claim.notes && (
            <Section title="Notes">
              <p className="px-5 py-4 text-body-sm text-ink-muted">{claim.notes}</p>
            </Section>
          )}
        </div>
      </div>

      <ApproveModal
        open={approveOpen}
        claim={claim}
        onClose={() => setApproveOpen(false)}
        onConfirm={async (body) => {
          await insuranceApi.approveClaim(t, claim.id, body);
          toast.success('Claim approved.');
          await load();
        }}
      />
      <SettleModal
        open={settleOpen}
        remaining={amounts.remaining}
        onClose={() => setSettleOpen(false)}
        onConfirm={async (body) => {
          await insuranceApi.settleClaim(t, claim.id, body);
          toast.success('Settlement recorded.');
          await load();
        }}
      />
      <ReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject claim"
        description="Rejection requires a documented reason and will close the claim."
        confirmLabel="Reject claim"
        onConfirm={async (reason) => {
          await insuranceApi.rejectClaim(t, claim.id, reason);
          toast.success('Claim rejected.');
          await load();
        }}
      />
      <ReasonModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel claim"
        description="Cancellation requires a reason. Settled claims cannot be cancelled."
        confirmLabel="Cancel claim"
        onConfirm={async (reason) => {
          await insuranceApi.cancelClaim(t, claim.id, reason);
          toast.success('Claim cancelled.');
          await load();
        }}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-label-md uppercase text-ink-soft">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  );
}

function ApproveModal({
  open,
  claim,
  onClose,
  onConfirm,
}: {
  open: boolean;
  claim: InsuranceClaim;
  onClose: () => void;
  onConfirm: (body: { approvedAmount?: number; patientShare?: number; notes?: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [approved, setApproved] = useState('');
  const [share, setShare] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApproved((claim.claimAmount / 100).toFixed(2));
    setShare(claim.patientShare != null ? (claim.patientShare / 100).toFixed(2) : '');
    setNotes('');
  }, [open, claim]);

  async function submit() {
    setBusy(true);
    try {
      await onConfirm({
        approvedAmount: approved ? toMinor(approved) ?? undefined : undefined,
        patientShare: share ? toMinor(share) ?? undefined : undefined,
        notes: notes.trim() || undefined,
      });
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
      title="Approve claim"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">
          Claim amount: <span className="font-medium text-ink">{money(claim.claimAmount)}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Approved amount">
            <Input inputMode="decimal" value={approved} onChange={(e) => setApproved(e.target.value)} autoFocus />
          </FormField>
          <FormField label="Patient share">
            <Input inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

function SettleModal({
  open,
  remaining,
  onClose,
  onConfirm,
}: {
  open: boolean;
  remaining: number;
  onClose: () => void;
  onConfirm: (body: { amount?: number; transactionId?: string; notes?: string }) => Promise<void>;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [txn, setTxn] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount((remaining / 100).toFixed(2));
    setTxn('');
    setNotes('');
  }, [open, remaining]);

  async function submit() {
    setBusy(true);
    try {
      await onConfirm({
        amount: amount ? toMinor(amount) ?? undefined : undefined,
        transactionId: txn.trim() || undefined,
        notes: notes.trim() || undefined,
      });
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
      title="Record settlement"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Settle claim
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">
          Approved outstanding: <span className="font-medium text-ink">{money(remaining)}</span>
        </div>
        <FormField label="Settlement amount">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </FormField>
        <FormField label="Transaction/reference ID">
          <Input value={txn} onChange={(e) => setTxn(e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export default function ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected
      requireModule="INSURANCE"
      allowedRoles={['INSURANCE_STAFF', 'BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN']}
      requirePermission={['insurance.read']}
    >
      <ClaimDetail id={params.id} />
    </Protected>
  );
}
