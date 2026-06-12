'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type AdvanceDeposit } from '@/lib/finance';
import { formatDateTime, money, toMinor } from '@/lib/format';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  ReasonModal,
  Section,
  Select,
  Spinner,
  StatusChip,
} from '@/components/ui';

const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER'];

export function DepositsList() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [patientId, setPatientId] = useState('');
  const [rows, setRows] = useState<AdvanceDeposit[] | null>([]);
  const [err, setErr] = useState<string | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [refundId, setRefundId] = useState<string | null>(null);

  const load = useCallback(
    async (nextPatientId = patientId) => {
      const id = nextPatientId.trim();
      if (!id || !t) {
        setRows([]);
        return;
      }
      setErr(null);
      setRows(null);
      try {
        setRows(await financeApi.advanceDeposits(t, id));
      } catch (e) {
        setErr((e as Error).message);
        setRows([]);
      }
    },
    [patientId, t],
  );

  useEffect(() => {
    setRows([]);
  }, [patientId]);

  return (
    <>
      <div className="space-y-6">
        <Section
          title="Patient ledger"
          action={
            <Button icon={Plus} onClick={() => setCollectOpen(true)}>
              Collect deposit
            </Button>
          }
        >
          <form
            className="grid gap-4 p-5 md:grid-cols-[minmax(260px,1fr)_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <FormField label="Patient ID" required>
              <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Patient UUID" />
            </FormField>
            <div className="flex items-end">
              <Button variant="dark" disabled={!patientId.trim()}>
                Load ledger
              </Button>
            </div>
          </form>
        </Section>

        {err && <ErrorState message={err} />}
        {rows === null ? (
          <Spinner label="Loading deposits..." />
        ) : rows.length === 0 ? (
          <EmptyState title="No deposits found" hint="Load a patient ledger or collect a new advance deposit." />
        ) : (
          <Section title={`${rows.length} deposit${rows.length === 1 ? '' : 's'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Method</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-canvas">
                      <td className="px-5 py-3 text-ink">{formatDateTime(row.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="font-mono text-label-md text-ink">{row.patientId.slice(0, 8)}</div>
                        {row.admissionId && (
                          <div className="text-label-sm text-ink-soft">Admission {row.admissionId.slice(0, 8)}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-ink">{money(row.amount)}</td>
                      <td className="px-5 py-3 text-ink-muted">{row.paymentMethod.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3">
                        <StatusChip status={row.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {row.status === 'COLLECTED' ? (
                          <Button size="sm" variant="danger" onClick={() => setRefundId(row.id)}>
                            Refund
                          </Button>
                        ) : (
                          <span className="text-label-sm text-ink-soft">{row.notes ?? '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>

      <CollectDepositModal
        open={collectOpen}
        patientId={patientId}
        onPatientId={setPatientId}
        onClose={() => setCollectOpen(false)}
        onSaved={async (nextPatientId) => {
          setPatientId(nextPatientId);
          toast.success('Deposit collected.');
          await load(nextPatientId);
        }}
      />
      <ReasonModal
        open={!!refundId}
        onClose={() => setRefundId(null)}
        title="Refund advance deposit"
        confirmLabel="Refund"
        onConfirm={async (reason) => {
          await financeApi.refundAdvanceDeposit(t, refundId!, reason);
          toast.success('Deposit refunded.');
          setRefundId(null);
          await load();
        }}
      />
    </>
  );
}

function CollectDepositModal({
  open,
  patientId,
  onPatientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  patientId: string;
  onPatientId: (patientId: string) => void;
  onClose: () => void;
  onSaved: (patientId: string) => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [localPatientId, setLocalPatientId] = useState(patientId);
  const [admissionId, setAdmissionId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalPatientId(patientId);
      setAdmissionId('');
      setAmount('');
      setPaymentMethod('CASH');
      setTransactionId('');
      setNotes('');
      setBusy(false);
    }
  }, [open, patientId]);

  async function submit() {
    const parsed = toMinor(amount);
    if (!activeTenantId || !localPatientId.trim() || !parsed || parsed <= 0) return;
    setBusy(true);
    try {
      await financeApi.collectAdvanceDeposit(activeTenantId, {
        patientId: localPatientId.trim(),
        admissionId: admissionId.trim() || undefined,
        amount: parsed,
        paymentMethod,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onPatientId(localPatientId.trim());
      await onSaved(localPatientId.trim());
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
      title="Collect advance deposit"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!localPatientId.trim() || !toMinor(amount)}>
            Collect
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Patient ID" required>
          <Input value={localPatientId} onChange={(e) => setLocalPatientId(e.target.value)} />
        </FormField>
        <FormField label="Admission ID">
          <Input value={admissionId} onChange={(e) => setAdmissionId(e.target.value)} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Amount" required>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <FormField label="Method" required>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Transaction ID">
          <Input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}
