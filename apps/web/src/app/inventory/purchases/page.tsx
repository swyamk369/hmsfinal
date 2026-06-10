'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ShoppingCart } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import {
  purchaseApi,
  supplierApi,
  inventoryApi,
  type PurchaseOrder,
  type Supplier,
  type InventoryItem,
} from '@/lib/inventory';
import { money, toMinor, formatDate } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  Select,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  StatCard,
} from '@/components/ui';

interface Line {
  itemId: string;
  quantity: number;
  unitCost: number; // minor
}

function PurchasesInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const canManage = useMemo(
    () => new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []).has('inventory.purchase.manage'),
    [profile, activeTenantId],
  );

  const [rows, setRows] = useState<PurchaseOrder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await purchaseApi.list(t, status ? { status } : {}));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, status]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setCreating(true);
  }, []);

  const pending = (rows ?? []).filter((p) => p.status === 'DRAFT' || p.status === 'ORDERED').length;
  const openValue = (rows ?? []).filter((p) => p.status !== 'CANCELLED').reduce((s, p) => s + p.totalValue, 0);

  return (
    <>
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to inventory
      </Link>
      <PageHeader
        title="Procurement"
        subtitle="Purchase orders and goods receipt"
        action={
          canManage ? (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New Purchase Order
            </Button>
          ) : undefined
        }
      />

      {err && <ErrorState message={err} />}

      {rows && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Purchase orders" value={rows.length} />
          <StatCard label="Pending" value={pending} hint="draft + ordered" />
          <StatCard label="Open order value" value={money(openValue)} />
        </div>
      )}

      <Section
        title="Purchase orders"
        action={
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="DRAFT">Draft</option>
            <option value="ORDERED">Ordered</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        }
      >
        {!rows ? (
          <Spinner label="Loading purchase orders…" />
        ) : rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={ShoppingCart}
              title="No purchase orders"
              hint="Create a purchase order to procure stock from a vendor."
              action={
                canManage ? (
                  <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                    New Purchase Order
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">PO</th>
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 text-right font-medium">Qty</th>
                  <th className="px-5 py-3 text-right font-medium">Value</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((po) => (
                  <tr
                    key={po.id}
                    className="cursor-pointer hover:bg-canvas"
                    onClick={() => router.push(`/inventory/purchases/${po.id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-ink-muted">{po.invoiceRef || `PO-${po.id.slice(0, 8)}`}</td>
                    <td className="px-5 py-3 font-medium text-ink">{po.supplier?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-ink-muted">{po.totalQuantity}</td>
                    <td className="px-5 py-3 text-right font-medium text-ink">{money(po.totalValue)}</td>
                    <td className="px-5 py-3 text-ink-muted">{formatDate(po.createdAt)}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={po.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <CreatePOModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(po) => router.push(`/inventory/purchases/${po.id}`)}
      />
    </>
  );
}

function CreatePOModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (po: PurchaseOrder) => void;
}) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && t) {
      Promise.all([supplierApi.list(t), inventoryApi.listItems(t)])
        .then(([s, i]) => {
          setSuppliers(s.filter((x) => x.active));
          setItems(i);
        })
        .catch((e) => toast.error((e as Error).message));
      setSupplierId('');
      setInvoiceRef('');
      setLines([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t]);

  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  function addLine() {
    setLines((l) => [...l, { itemId: items[0]?.id ?? '', quantity: 1, unitCost: 0 }]);
  }
  function update(i: number, patch: Partial<Line>) {
    setLines((l) => l.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function submit(submitStatus: 'DRAFT' | 'ORDERED') {
    if (!supplierId || lines.length === 0) {
      toast.error('Select a vendor and add at least one line.');
      return;
    }
    if (lines.some((l) => !l.itemId || l.quantity < 1)) {
      toast.error('Every line needs an item and quantity.');
      return;
    }
    setBusy(true);
    try {
      const po = await purchaseApi.create(t, {
        supplierId,
        invoiceRef: invoiceRef.trim() || undefined,
        status: submitStatus,
        items: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitCost: l.unitCost })),
      });
      toast.success(`Purchase order ${submitStatus === 'DRAFT' ? 'saved as draft' : 'placed'}.`);
      onCreated(po);
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
      title="New Purchase Order"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={() => submit('DRAFT')}
            loading={busy}
            disabled={!supplierId || lines.length === 0}
          >
            Save draft
          </Button>
          <Button onClick={() => submit('ORDERED')} loading={busy} disabled={!supplierId || lines.length === 0}>
            Place order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Vendor" required>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Invoice / reference">
            <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="PO-2024-001" />
          </FormField>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-label-md uppercase text-ink-soft">Line items</span>
            <Button size="sm" variant="ghost" icon={Plus} onClick={addLine} disabled={items.length === 0}>
              Add line
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-body-sm text-ink-soft">Create inventory items first.</p>
          ) : lines.length === 0 ? (
            <p className="rounded-md border border-line bg-canvas px-3 py-3 text-body-sm text-ink-soft">
              No lines yet.
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-end gap-2">
                  <label className="flex-1">
                    <span className="mb-1 block text-label-sm text-ink-soft">Item</span>
                    <Select value={l.itemId} onChange={(e) => update(i, { itemId: e.target.value })}>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="w-20">
                    <span className="mb-1 block text-label-sm text-ink-soft">Qty</span>
                    <Input
                      inputMode="numeric"
                      value={String(l.quantity)}
                      onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </label>
                  <label className="w-24">
                    <span className="mb-1 block text-label-sm text-ink-soft">Unit cost</span>
                    <Input
                      inputMode="decimal"
                      value={(l.unitCost / 100).toString()}
                      onChange={(e) => update(i, { unitCost: toMinor(e.target.value) ?? 0 })}
                    />
                  </label>
                  <button
                    onClick={() => setLines((x) => x.filter((_, j) => j !== i))}
                    className="mb-1.5 rounded p-1.5 text-ink-soft hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between rounded-md bg-canvas px-3 py-2 text-title-lg text-ink">
          <span>Order total</span>
          <span>{money(total)}</span>
        </div>
      </div>
    </Modal>
  );
}

export default function PurchasesPage() {
  return (
    <Protected requireModule="INVENTORY" allowedRoles={['INVENTORY_MGR', 'HOSPITAL_ADMIN']}>
      <PurchasesInner />
    </Protected>
  );
}
