'use client';

import { useCallback, useEffect, useState } from 'react';
import { FilePlus2, Plus, Trash2 } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type CostEstimate } from '@/lib/finance';
import { formatDate, formatDateTime, money, toMinor } from '@/lib/format';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Section,
  Spinner,
  StatusChip,
  Textarea,
} from '@/components/ui';
import { FinanceShell } from '../finance-ui';

type DraftItem = {
  name: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

function EstimatesInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [patientId, setPatientId] = useState('');
  const [rows, setRows] = useState<CostEstimate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    setRows(null);
    try {
      setRows(await financeApi.costEstimates(t, patientId.trim() || undefined));
    } catch (e) {
      setErr((e as Error).message);
      setRows([]);
    }
  }, [patientId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(row: CostEstimate, status: string) {
    try {
      await financeApi.updateCostEstimateStatus(t, row.id, status);
      toast.success('Estimate updated.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Cost Estimates"
        subtitle="Generate and issue patient cost estimates"
        action={
          <Button icon={FilePlus2} onClick={() => setCreateOpen(true)}>
            New estimate
          </Button>
        }
      />
      <FinanceShell>
        <div className="space-y-6">
          <Section title="Filter">
            <form
              className="grid gap-4 p-5 md:grid-cols-[minmax(260px,1fr)_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
            >
              <FormField label="Patient ID">
                <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Patient UUID" />
              </FormField>
              <div className="flex items-end">
                <Button variant="dark">Apply</Button>
              </div>
            </form>
          </Section>

          {err && <ErrorState message={err} />}
          {!rows ? (
            <Spinner label="Loading estimates..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No estimates found"
              action={
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  Create estimate
                </Button>
              }
            />
          ) : (
            <Section title={`${rows.length} estimate${rows.length === 1 ? '' : 's'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Created</th>
                      <th className="px-5 py-3 font-medium">Valid Until</th>
                      <th className="px-5 py-3 text-right font-medium">Net Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-canvas">
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink">{row.patient?.fullName ?? 'Patient'}</div>
                          <div className="text-label-sm text-ink-soft">{row.patient?.mrn ?? row.patientId}</div>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{formatDateTime(row.createdAt)}</td>
                        <td className="px-5 py-3 text-ink-muted">{formatDate(row.validUntil)}</td>
                        <td className="px-5 py-3 text-right font-medium text-ink">{money(row.netAmount)}</td>
                        <td className="px-5 py-3">
                          <StatusChip status={row.status} />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            {row.status === 'DRAFT' && (
                              <Button size="sm" onClick={() => void updateStatus(row, 'ISSUED')}>
                                Issue
                              </Button>
                            )}
                            {row.status !== 'CANCELLED' && row.status !== 'CONVERTED' && (
                              <Button size="sm" variant="ghost" onClick={() => void updateStatus(row, 'CANCELLED')}>
                                Cancel
                              </Button>
                            )}
                          </div>
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
      <CreateEstimateModal
        open={createOpen}
        patientId={patientId}
        onClose={() => setCreateOpen(false)}
        onSaved={async (nextPatientId) => {
          setPatientId(nextPatientId);
          toast.success('Estimate created.');
          await load();
        }}
      />
    </>
  );
}

function CreateEstimateModal({
  open,
  patientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  patientId: string;
  onClose: () => void;
  onSaved: (patientId: string) => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [localPatientId, setLocalPatientId] = useState(patientId);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ name: '', quantity: '1', unitPrice: '', taxRate: '0' }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalPatientId(patientId);
      setValidUntil('');
      setNotes('');
      setItems([{ name: '', quantity: '1', unitPrice: '', taxRate: '0' }]);
      setBusy(false);
    }
  }, [open, patientId]);

  const total = items.reduce((sum, item) => {
    const unit = toMinor(item.unitPrice) ?? 0;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const taxBps = Math.round((Number(item.taxRate) || 0) * 100);
    const line = unit * quantity;
    return sum + line + Math.round((line * taxBps) / 10000);
  }, 0);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function submit() {
    const cleanItems = items
      .map((item) => ({
        name: item.name.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: toMinor(item.unitPrice) ?? 0,
        taxRate: Math.round((Number(item.taxRate) || 0) * 100),
      }))
      .filter((item) => item.name && item.unitPrice > 0);
    if (!activeTenantId || !localPatientId.trim() || cleanItems.length === 0) return;
    setBusy(true);
    try {
      await financeApi.createCostEstimate(activeTenantId, {
        patientId: localPatientId.trim(),
        validUntil: validUntil || undefined,
        notes: notes.trim() || undefined,
        items: cleanItems,
      });
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
      title="Create cost estimate"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!localPatientId.trim() || total <= 0}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Patient ID" required>
          <Input value={localPatientId} onChange={(e) => setLocalPatientId(e.target.value)} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Valid until">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </FormField>
          <FormField label="Estimate total">
            <Input value={money(total)} readOnly />
          </FormField>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="label">Items</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={Plus}
              onClick={() =>
                setItems((current) => [...current, { name: '', quantity: '1', unitPrice: '', taxRate: '0' }])
              }
            >
              Add
            </Button>
          </div>
          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border border-line bg-canvas p-3 sm:grid-cols-[1fr_72px_100px_80px_32px]"
            >
              <Input
                value={item.name}
                onChange={(e) => updateItem(index, { name: e.target.value })}
                placeholder="Item name"
              />
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, { quantity: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                placeholder="Price"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.taxRate}
                onChange={(e) => updateItem(index, { taxRate: e.target.value })}
                placeholder="Tax %"
              />
              <button
                type="button"
                className="grid h-9 w-8 place-items-center rounded text-ink-soft hover:bg-surface hover:text-danger"
                onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                aria-label="Remove item"
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <FormField label="Notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export default function EstimatesPage() {
  return (
    <Protected
      requireModule="BILLING"
      requirePermission={['finance.read', 'bill.read', 'finance.charge.manage', 'bill.write']}
    >
      <EstimatesInner />
    </Protected>
  );
}
