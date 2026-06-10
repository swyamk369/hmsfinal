'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ScrollText } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { inventoryApi, TXN_TYPES, type InventoryItem, type InventoryTransaction } from '@/lib/inventory';
import { formatDateTime } from '@/lib/format';
import { Section, PageHeader, Spinner, ErrorState, EmptyState, Badge, Select, Modal } from '@/components/ui';

function TransactionsInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rows, setRows] = useState<InventoryTransaction[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState('');
  const [detail, setDetail] = useState<InventoryTransaction | null>(null);

  useEffect(() => {
    if (t)
      inventoryApi
        .listItems(t)
        .then(setItems)
        .catch(() => {});
  }, [t]);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (itemId) params.itemId = itemId;
      if (type) params.type = type;
      setRows(await inventoryApi.transactions(t, params));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, itemId, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id.slice(0, 8);

  return (
    <>
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to inventory
      </Link>
      <PageHeader title="Transaction Ledger" subtitle="Append-only record of every stock movement" />

      {err && <ErrorState message={err} />}

      <Section
        title="Ledger"
        action={
          <div className="flex items-center gap-2">
            <Select className="w-48" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">All items</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
            <Select className="w-36" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {TXN_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {!rows ? (
          <Spinner label="Loading ledger…" />
        ) : rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={ScrollText}
              title="No transactions"
              hint="Stock-in, dispense, adjustments, and returns are recorded here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 text-right font-medium">Qty</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((tx) => (
                  <tr key={tx.id} className="cursor-pointer hover:bg-canvas" onClick={() => setDetail(tx)}>
                    <td className="px-5 py-3 text-ink-muted">{formatDateTime(tx.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Badge
                        tone={
                          tx.type === 'DISPENSE' || tx.type === 'EXPIRY'
                            ? 'danger'
                            : tx.type === 'ADJUSTMENT'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-ink">{nameOf(tx.itemId)}</td>
                    <td
                      className={`px-5 py-3 text-right font-medium ${tx.quantity < 0 ? 'text-danger-fg' : 'text-ink'}`}
                    >
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{tx.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Transaction detail">
        {detail && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-body-sm">
            <Row label="Type" value={detail.type} />
            <Row label="Quantity" value={detail.quantity > 0 ? `+${detail.quantity}` : detail.quantity} />
            <Row label="Item" value={nameOf(detail.itemId)} />
            <Row label="Batch" value={detail.batchId ? detail.batchId.slice(0, 8) : '—'} />
            <Row label="When" value={formatDateTime(detail.createdAt)} />
            <div className="col-span-2">
              <dt className="text-ink-soft">Reason</dt>
              <dd className="text-ink">{detail.reason || '—'}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Protected requireModule="INVENTORY" allowedRoles={['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN']}>
      <TransactionsInner />
    </Protected>
  );
}
