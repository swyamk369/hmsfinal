'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, PackagePlus, SlidersHorizontal, Pencil, Search } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { inventoryApi, ITEM_TYPES, type InventoryItem } from '@/lib/inventory';
import { money, toMinor, formatDate } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  Badge,
} from '@/components/ui';

function ItemsInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = useMemo(
    () => new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []),
    [profile, activeTenantId],
  );
  const has = (p: string) => perms.has(p);

  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<InventoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [stockInItem, setStockInItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const load = useCallback(
    async (term?: string) => {
      if (!t) return;
      setErr(null);
      try {
        setItems(await inventoryApi.listItems(t, term));
      } catch (e) {
        setErr((e as Error).message);
      }
    },
    [t],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setCreating(true);
  }, []);

  const unitPrice = (it: InventoryItem) => {
    const b = it.batches
      .filter((x) => x.quantity > 0)
      .sort((a, c) => ((a.expiryDate ?? '9') > (c.expiryDate ?? '9') ? 1 : -1))[0];
    return b ? money(b.salePrice) : '—';
  };

  return (
    <>
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to inventory
      </Link>
      <PageHeader
        title="Stock Master"
        subtitle="Item master, batches, and stock levels"
        action={
          has('inventory.item.write') ? (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Add New Item
            </Button>
          ) : undefined
        }
      />

      {err && <ErrorState message={err} />}

      <Section
        title="Items"
        action={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(q.trim());
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input
              className="w-56 pl-8"
              placeholder="Search item name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
        }
      >
        {!items ? (
          <Spinner label="Loading items…" />
        ) : items.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={PackagePlus}
              title="No inventory items"
              action={
                has('inventory.item.write') ? (
                  <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                    Add New Item
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
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 text-right font-medium">Stock</th>
                  <th className="px-5 py-3 text-right font-medium">Reorder</th>
                  <th className="px-5 py-3 font-medium">Earliest expiry</th>
                  <th className="px-5 py-3 text-right font-medium">Unit price</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-medium text-ink">
                      {it.name}
                      {!it.active && <span className="ml-2 text-label-sm text-ink-soft">(inactive)</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone="slate">{it.type}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-ink">
                      {it.totalStock} <span className="text-label-sm text-ink-soft">{it.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-ink-muted">{it.lowStockThreshold}</td>
                    <td className="px-5 py-3 text-ink-muted">{formatDate(it.earliestExpiry)}</td>
                    <td className="px-5 py-3 text-right text-ink-muted">{unitPrice(it)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={it.status === 'OUT' ? 'danger' : it.status === 'LOW' ? 'warning' : 'success'}>
                        {it.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {has('inventory.stock_in') && (
                          <Button size="sm" variant="ghost" icon={PackagePlus} onClick={() => setStockInItem(it)}>
                            Stock in
                          </Button>
                        )}
                        {has('inventory.adjust') && it.batches.length > 0 && (
                          <Button size="sm" variant="ghost" icon={SlidersHorizontal} onClick={() => setAdjustItem(it)}>
                            Adjust
                          </Button>
                        )}
                        {has('inventory.item.write') && (
                          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(it)}>
                            Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <ItemModal
        open={creating || !!edit}
        item={edit}
        onClose={() => {
          setCreating(false);
          setEdit(null);
        }}
        onSaved={() => load(q.trim())}
      />
      <StockInModal item={stockInItem} onClose={() => setStockInItem(null)} onSaved={() => load(q.trim())} />
      <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} onSaved={() => load(q.trim())} />
    </>
  );
}

function ItemModal({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    type: 'DRUG',
    unit: 'unit',
    sku: '',
    lowStockThreshold: '10',
    active: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      setForm(
        item
          ? {
              name: item.name,
              type: item.type,
              unit: item.unit,
              sku: item.sku ?? '',
              lowStockThreshold: String(item.lowStockThreshold),
              active: item.active,
            }
          : { name: '', type: 'DRUG', unit: 'unit', sku: '', lowStockThreshold: '10', active: true },
      );
  }, [open, item]);

  async function submit() {
    if (!activeTenantId || !form.name.trim()) return;
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        unit: form.unit.trim() || 'unit',
        sku: form.sku.trim() || undefined,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
      };
      if (item) await inventoryApi.updateItem(activeTenantId, item.id, { ...body, active: form.active });
      else await inventoryApi.createItem(activeTenantId, body);
      toast.success(item ? 'Item updated.' : 'Item created.');
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
      title={item ? 'Edit item' : 'Add inventory item'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!form.name.trim()}>
            {item ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Amoxicillin 500mg"
            autoFocus
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Type">
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {ITEM_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Unit">
            <Input
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="tablet, vial…"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="SKU">
            <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          </FormField>
          <FormField label="Low-stock threshold">
            <Input
              inputMode="numeric"
              value={form.lowStockThreshold}
              onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
            />
          </FormField>
        </div>
        {item && (
          <label className="flex items-center gap-2 text-body-sm text-ink-muted">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
            />
            Active
          </label>
        )}
      </div>
    </Modal>
  );
}

function StockInModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ batchNumber: '', expiryDate: '', quantity: '', unitCost: '', salePrice: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) setForm({ batchNumber: '', expiryDate: '', quantity: '', unitCost: '', salePrice: '' });
  }, [item]);

  async function submit() {
    if (!activeTenantId || !item) return;
    const quantity = Number(form.quantity);
    const salePrice = toMinor(form.salePrice);
    if (!form.batchNumber.trim() || !quantity || quantity <= 0 || salePrice == null) {
      toast.error('Batch number, quantity and sale price are required.');
      return;
    }
    setBusy(true);
    try {
      await inventoryApi.stockIn(activeTenantId, {
        itemId: item.id,
        batchNumber: form.batchNumber.trim(),
        expiryDate: form.expiryDate || undefined,
        quantity,
        unitCost: toMinor(form.unitCost) ?? 0,
        salePrice,
      });
      toast.success('Stock added.');
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
      open={!!item}
      onClose={onClose}
      title={`Stock in — ${item?.name ?? ''}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Add stock
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Batch number" required>
            <Input
              value={form.batchNumber}
              onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))}
              placeholder="BAT-001"
              autoFocus
            />
          </FormField>
          <FormField label="Expiry date">
            <Input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Quantity" required>
            <Input
              inputMode="numeric"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </FormField>
          <FormField label="Unit cost">
            <Input
              inputMode="decimal"
              value={form.unitCost}
              onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
            />
          </FormField>
          <FormField label="Sale price" required>
            <Input
              inputMode="decimal"
              value={form.salePrice}
              onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

function AdjustModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [batchId, setBatchId] = useState('');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setBatchId(item.batches[0]?.id ?? '');
      setDelta('');
      setReason('');
    }
  }, [item]);

  async function submit() {
    if (!activeTenantId || !item || !batchId) return;
    const d = Number(delta);
    if (!d) {
      toast.error('Enter a non-zero adjustment.');
      return;
    }
    if (!reason.trim()) {
      toast.error('A reason is required.');
      return;
    }
    setBusy(true);
    try {
      await inventoryApi.adjust(activeTenantId, { batchId, delta: d, reason: reason.trim() });
      toast.success('Stock adjusted.');
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
      open={!!item}
      onClose={onClose}
      title={`Adjust stock — ${item?.name ?? ''}`}
      danger
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!reason.trim() || !delta}>
            Apply adjustment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Batch" required>
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {(item?.batches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchNumber} · {b.quantity} {item?.unit} · exp{' '}
                {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Adjustment (+/−)" required>
          <Input
            inputMode="numeric"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="-5 to remove, 5 to add"
          />
        </FormField>
        <FormField label="Reason" required>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Damage, audit discrepancy, spoilage…"
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default function InventoryItemsPage() {
  return (
    <Protected requireModule="INVENTORY" allowedRoles={['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN']}>
      <ItemsInner />
    </Protected>
  );
}
