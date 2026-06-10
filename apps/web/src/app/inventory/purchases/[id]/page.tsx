'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, PackageCheck, Ban } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { purchaseApi, type PurchaseOrder } from '@/lib/inventory';
import { money, toMinor, formatDate } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  ReasonModal,
  Input,
  PageHeader,
  Spinner,
  ErrorState,
  StatusChip,
} from '@/components/ui';

interface ReceiveRow {
  receivedQuantity: number;
  batchNumber: string;
  expiryDate: string;
  salePrice: number; // minor
}

function PoDetail({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = useMemo(
    () => new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []),
    [profile, activeTenantId],
  );

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setPo(await purchaseApi.get(t, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!po) return <Spinner label="Loading purchase order…" />;
  const open = po.status === 'DRAFT' || po.status === 'ORDERED';

  return (
    <>
      <Link
        href="/inventory/purchases"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to procurement
      </Link>

      <PageHeader
        title={po.invoiceRef || `PO-${po.id.slice(0, 8)}`}
        subtitle={po.supplier?.name ?? ''}
        action={
          <div className="flex gap-2">
            {open && perms.has('inventory.stock_in') && (
              <Button icon={PackageCheck} onClick={() => setReceiveOpen(true)}>
                Receive goods
              </Button>
            )}
            {open && perms.has('inventory.purchase.manage') && (
              <Button variant="danger" icon={Ban} onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4">
        <StatusChip status={po.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Line items">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                  <th className="px-5 py-2 font-medium">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {po.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-5 py-2.5 text-ink">
                      {it.item?.name ?? it.itemId.slice(0, 8)}
                      {it.item?.sku ? <span className="ml-1 text-label-sm text-ink-soft">{it.item.sku}</span> : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right text-ink-muted">{it.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-ink-muted">{money(it.unitCost)}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-ink">{money(it.quantity * it.unitCost)}</td>
                    <td className="px-5 py-2.5 text-label-sm text-ink-soft">{it.batchId ? 'Received' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>

        <Section title="Summary">
          <div className="space-y-3 px-5 py-4 text-body-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">Vendor</span>
              <span className="text-ink">{po.supplier?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Created</span>
              <span className="text-ink">{formatDate(po.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Total qty</span>
              <span className="text-ink">{po.totalQuantity}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-title-lg">
              <span className="text-ink">Total value</span>
              <span className="text-ink">{money(po.totalValue)}</span>
            </div>
          </div>
        </Section>
      </div>

      <ReceiveModal open={receiveOpen} po={po} onClose={() => setReceiveOpen(false)} onSaved={load} />
      <ReasonModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel purchase order"
        description="Cancelling voids this PO. Received purchase orders cannot be cancelled."
        confirmLabel="Cancel PO"
        onConfirm={async (reason) => {
          await purchaseApi.cancel(t, id, reason);
          toast.success('Purchase order cancelled.');
          await load();
        }}
      />
    </>
  );
}

function ReceiveModal({
  po,
  open,
  onClose,
  onSaved,
}: {
  po: PurchaseOrder;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, ReceiveRow>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const seed: Record<string, ReceiveRow> = {};
      for (const it of po.items)
        seed[it.id] = { receivedQuantity: it.quantity, batchNumber: '', expiryDate: '', salePrice: it.unitCost };
      setRows(seed);
    }
  }, [open, po]);

  function set(itemId: string, patch: Partial<ReceiveRow>) {
    setRows((r) => ({ ...r, [itemId]: { ...r[itemId], ...patch } }));
  }

  async function submit() {
    const lines = po.items
      .map((it) => ({ purchaseOrderItemId: it.id, ...rows[it.id] }))
      .filter((l) => l.receivedQuantity > 0);
    if (lines.length === 0) {
      toast.error('Enter at least one received quantity.');
      return;
    }
    if (lines.some((l) => !l.batchNumber.trim())) {
      toast.error('Each received line needs a batch number.');
      return;
    }
    setBusy(true);
    try {
      await purchaseApi.receive(activeTenantId!, po.id, {
        lines: lines.map((l) => ({
          purchaseOrderItemId: l.purchaseOrderItemId,
          receivedQuantity: l.receivedQuantity,
          batchNumber: l.batchNumber.trim(),
          expiryDate: l.expiryDate || undefined,
          salePrice: l.salePrice,
        })),
      });
      toast.success('Goods received — stock updated.');
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
      title="Goods Received Note (GRN)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button icon={PackageCheck} onClick={submit} loading={busy}>
            Receive &amp; update stock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body-sm text-ink-muted">
          Enter received quantity, batch number, expiry, and sale price per line. Expired batches are rejected.
        </p>
        {po.items.map((it) => {
          const r = rows[it.id] ?? { receivedQuantity: 0, batchNumber: '', expiryDate: '', salePrice: 0 };
          return (
            <div key={it.id} className="rounded-md border border-line p-3">
              <div className="mb-2 text-body-sm font-medium text-ink">
                {it.item?.name ?? it.itemId.slice(0, 8)}{' '}
                <span className="text-label-sm text-ink-soft">(ordered {it.quantity})</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label>
                  <span className="mb-1 block text-label-sm text-ink-soft">Received</span>
                  <Input
                    inputMode="numeric"
                    value={String(r.receivedQuantity)}
                    onChange={(e) => set(it.id, { receivedQuantity: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-label-sm text-ink-soft">Batch no.</span>
                  <Input value={r.batchNumber} onChange={(e) => set(it.id, { batchNumber: e.target.value })} />
                </label>
                <label>
                  <span className="mb-1 block text-label-sm text-ink-soft">Expiry</span>
                  <Input
                    type="date"
                    value={r.expiryDate}
                    onChange={(e) => set(it.id, { expiryDate: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-label-sm text-ink-soft">Sale price</span>
                  <Input
                    inputMode="decimal"
                    value={(r.salePrice / 100).toString()}
                    onChange={(e) => set(it.id, { salePrice: toMinor(e.target.value) ?? 0 })}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export default function PoDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="INVENTORY" allowedRoles={['INVENTORY_MGR', 'HOSPITAL_ADMIN']}>
      <PoDetail id={params.id} />
    </Protected>
  );
}
