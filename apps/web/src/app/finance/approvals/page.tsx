'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type FinanceApproval } from '@/lib/finance';
import { formatDateTime, money, toMinor } from '@/lib/format';
import { Button, EmptyState, ErrorState, FormField, Input, Modal, PageHeader, ReasonModal, Section, Select, Spinner, StatusChip, Textarea } from '@/components/ui';
import { FinanceShell } from '../finance-ui';

const APPROVAL_TYPES = ['REFUND', 'DISCOUNT', 'WRITE_OFF', 'BILL_CANCEL', 'DAY_CLOSE_REOPEN', 'DISCHARGE_OVERRIDE'];

function ApprovalsInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [rows, setRows] = useState<FinanceApproval[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [decision, setDecision] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await financeApi.approvals(t, status || undefined));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Finance Approvals"
        subtitle="Refund exceptions, bill cancellations, write-offs, and reopen requests"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={load}>Refresh</Button>
            <Button icon={Plus} onClick={() => setRequestOpen(true)}>Request approval</Button>
          </div>
        }
      />
      <FinanceShell>
        <div className="space-y-6">
          <Section title="Filter">
            <div className="grid gap-4 p-5 md:grid-cols-[220px_auto]">
              <FormField label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
              </FormField>
              <div className="flex items-end">
                <Button variant="dark" onClick={load}>Apply</Button>
              </div>
            </div>
          </Section>
          {err && <ErrorState message={err} />}
          {!rows ? (
            <Spinner label="Loading approvals..." />
          ) : rows.length === 0 ? (
            <EmptyState title="No approvals found" hint="Finance exceptions appear here once requested." />
          ) : (
            <Section title={`${rows.length} approval${rows.length === 1 ? '' : 's'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Entity</th>
                      <th className="px-5 py-3 font-medium">Reason</th>
                      <th className="px-5 py-3 text-right font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-canvas">
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink">{row.type.replace(/_/g, ' ')}</div>
                          <div className="text-label-sm text-ink-soft">{formatDateTime(row.requestedAt)}</div>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">
                          {row.entity}
                          {row.entityId && <div className="text-label-sm">{row.entityId.slice(0, 8)}</div>}
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{row.reason}</td>
                        <td className="px-5 py-3 text-right font-medium text-ink">{row.amount != null ? money(row.amount) : '-'}</td>
                        <td className="px-5 py-3"><StatusChip status={row.status} /></td>
                        <td className="px-5 py-3">
                          {row.status === 'PENDING' ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" icon={Check} onClick={() => setDecision({ id: row.id, action: 'approve' })}>Approve</Button>
                              <Button size="sm" variant="danger" icon={X} onClick={() => setDecision({ id: row.id, action: 'reject' })}>Reject</Button>
                            </div>
                          ) : (
                            <div className="text-right text-label-sm text-ink-soft">{row.decisionReason ?? 'Decided'}</div>
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
      </FinanceShell>
      <ReasonModal
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Approve finance request' : 'Reject finance request'}
        confirmLabel={decision?.action === 'approve' ? 'Approve' : 'Reject'}
        onConfirm={async (reason) => {
          if (!decision) return;
          if (decision.action === 'approve') await financeApi.approve(t, decision.id, reason);
          else await financeApi.reject(t, decision.id, reason);
          toast.success(`Approval ${decision.action === 'approve' ? 'approved' : 'rejected'}.`);
          await load();
        }}
      />
      <RequestApprovalModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onSaved={async () => {
          toast.success('Approval requested.');
          await load();
        }}
      />
    </>
  );
}

function RequestApprovalModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('WRITE_OFF');
  const [entity, setEntity] = useState('manual');
  const [entityId, setEntityId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setType('WRITE_OFF');
      setEntity('manual');
      setEntityId('');
      setAmount('');
      setReason('');
      setNotes('');
    }
  }, [open]);

  async function submit() {
    if (!activeTenantId || !reason.trim() || !entity.trim()) return;
    setBusy(true);
    try {
      const parsed = amount.trim() ? toMinor(amount) : undefined;
      await financeApi.requestApproval(activeTenantId, {
        type,
        entity: entity.trim(),
        entityId: entityId.trim() || undefined,
        amount: parsed ?? undefined,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
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
      open={open}
      onClose={onClose}
      title="Request finance approval"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={!reason.trim() || !entity.trim()}>Request</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {APPROVAL_TYPES.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}
            </Select>
          </FormField>
          <FormField label="Amount">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Entity" required>
          <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="bill, refund, finance_day_close..." />
        </FormField>
        <FormField label="Entity ID">
          <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} />
        </FormField>
        <FormField label="Reason" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export default function ApprovalsPage() {
  return (
    <Protected requireModule="BILLING" requirePermission={['finance.approval.manage']}>
      <ApprovalsInner />
    </Protected>
  );
}
