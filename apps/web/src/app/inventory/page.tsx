'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, TriangleAlert, CalendarClock, ShoppingCart, Truck, PackagePlus } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { inventoryApi, type InventoryAlerts, type InventoryStats, type InventoryTransaction } from '@/lib/inventory';
import { money, formatDate, formatDateTime } from '@/lib/format';
import { Button, Section, PageHeader, StatCard, Spinner, ErrorState, EmptyState, Badge } from '@/components/ui';

function InventoryInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [alerts, setAlerts] = useState<InventoryAlerts | null>(null);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [txns, setTxns] = useState<InventoryTransaction[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const [a, s, tx] = await Promise.all([
        inventoryApi.alerts(t),
        inventoryApi.stats(t),
        inventoryApi.transactions(t),
      ]);
      setAlerts(a);
      setStats(s);
      setTxns(tx.slice(0, 10));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Stock, procurement, expiry alerts, and the transaction ledger"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory/items">
              <Button variant="ghost" icon={Boxes}>
                Items
              </Button>
            </Link>
            <Link href="/inventory/suppliers">
              <Button variant="ghost" icon={Truck}>
                Vendors
              </Button>
            </Link>
            <Link href="/inventory/purchases">
              <Button icon={ShoppingCart}>Procurement</Button>
            </Link>
          </div>
        }
      />

      {err && <ErrorState message={err} />}
      {!alerts && !err && <Spinner label="Loading inventory…" />}

      {alerts && stats && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Stock value" value={money(stats.stockValue)} />
            <StatCard label="Items" value={stats.itemCount} />
            <StatCard label="Low stock" value={stats.lowStockCount} />
            <StatCard label="Expiring (30d)" value={stats.expiringBatches} />
            <StatCard label="Pending POs" value={stats.pendingPurchases} />
            <StatCard label="Movements today" value={stats.movementsToday} />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <Link href="/inventory/items?new=1">
              <Button size="sm" variant="ghost" icon={PackagePlus}>
                Add item
              </Button>
            </Link>
            <Link href="/inventory/purchases?new=1">
              <Button size="sm" variant="ghost" icon={ShoppingCart}>
                Create PO
              </Button>
            </Link>
            <Link href="/inventory/suppliers?new=1">
              <Button size="sm" variant="ghost" icon={Truck}>
                Add vendor
              </Button>
            </Link>
            <Link href="/inventory/transactions">
              <Button size="sm" variant="ghost" icon={CalendarClock}>
                View ledger
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Low stock alerts">
              {alerts.lowStock.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState icon={TriangleAlert} title="All items above threshold" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {alerts.lowStock.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="font-medium text-ink">{a.name}</div>
                        <div className="text-label-sm text-ink-soft">
                          {a.totalStock} in stock · threshold {a.threshold}
                        </div>
                      </div>
                      <Badge tone={a.status === 'OUT' ? 'danger' : 'warning'}>
                        {a.status === 'OUT' ? 'Out of stock' : 'Low'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Expiring batches">
              {alerts.expiringBatches.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState icon={CalendarClock} title="Nothing expiring soon" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {alerts.expiringBatches.map((b) => (
                    <li key={b.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="font-medium text-ink">{b.itemName}</div>
                        <div className="text-label-sm text-ink-soft">
                          {b.batchNumber} · {b.quantity} units
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge tone={b.expired ? 'danger' : 'warning'}>{b.expired ? 'Expired' : 'Expiring'}</Badge>
                        <div className="mt-0.5 text-label-sm text-ink-soft">{formatDate(b.expiryDate)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section
            title="Recent transactions"
            className="mt-6"
            action={
              <Link href="/inventory/transactions" className="text-body-sm font-medium text-primary hover:underline">
                View ledger
              </Link>
            }
          >
            {!txns || txns.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  title="No transactions yet"
                  hint="Stock-in, dispense, adjustments, and returns appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {txns.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between px-5 py-3 text-body-sm">
                    <div className="flex items-center gap-3">
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
                      <span className="text-ink-muted">{tx.reason || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={tx.quantity < 0 ? 'text-danger-fg' : 'text-ink'}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </span>
                      <span className="text-label-sm text-ink-soft">{formatDateTime(tx.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </>
  );
}

export default function InventoryPage() {
  return (
    <Protected requireModule="INVENTORY" allowedRoles={['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN']}>
      <InventoryInner />
    </Protected>
  );
}
