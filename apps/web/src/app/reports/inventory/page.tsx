'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, ClipboardList, PackageSearch, Warehouse } from 'lucide-react';
import Protected from '@/components/Protected';
import { Button, ErrorState, FormField, Input, PageHeader, Section, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, money } from '@/lib/format';
import { reportsApi, type InventoryReport } from '@/lib/reports';
import { Breakdown, KpiGrid, ReportTable } from '../report-ui';

function InventoryReportPageInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [data, setData] = useState<InventoryReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      startDate,
      endDate,
      transactionType,
    }),
    [endDate, startDate, transactionType],
  );

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await reportsApi.inventory(t, params));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [params, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Inventory Report"
        subtitle={data ? `Stock value, expiry, low-stock risk, procurement, and ledger · updated ${formatDateTime(data.generatedAt)}` : 'Stock value, expiry, low-stock risk, procurement, and ledger'}
        action={<Button variant="ghost" onClick={load}>Refresh</Button>}
      />

      <div className="space-y-6">
        <Section title="Filters">
          <div className="grid gap-4 p-5 md:grid-cols-4">
            <FormField label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
            <FormField label="Transaction type">
              <Select value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
                <option value="">All transactions</option>
                <option value="STOCK_IN">Stock in</option>
                <option value="DISPENSE">Dispense</option>
                <option value="RETURN">Return</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </Select>
            </FormField>
            <div className="flex items-end">
              <Button variant="dark" onClick={load} className="w-full">
                Apply
              </Button>
            </div>
          </div>
        </Section>

        {err && <ErrorState message={err} />}
        {!data && !err ? (
          <Spinner label="Loading inventory report..." />
        ) : data ? (
          <>
            <KpiGrid
              items={[
                { label: 'Items', value: data.totals.itemCount ?? 0, icon: Boxes },
                { label: 'Stock value', value: money(data.totals.stockValue ?? 0), icon: Warehouse },
                { label: 'Low stock', value: data.totals.lowStock ?? 0, hint: `${data.totals.expiring ?? 0} expiring batches`, icon: AlertTriangle },
                { label: 'Expired batches', value: data.totals.expired ?? 0, icon: PackageSearch },
                { label: 'Pending POs', value: data.totals.pendingPurchases ?? 0, icon: ClipboardList },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <Breakdown title="Ledger transaction types" data={data.transactionType} />
              <Breakdown title="Purchase order status" data={data.purchaseStatus} />
            </div>

            <ReportTable
              title="Low-stock items"
              rows={data.lowStock}
              filename="inventory-low-stock.csv"
              columns={[
                { key: 'name', label: 'Item' },
                { key: 'totalStock', label: 'Stock' },
                { key: 'threshold', label: 'Threshold' },
              ]}
            />

            <ReportTable
              title="Expiring batches"
              rows={data.expiringBatches}
              filename="inventory-expiry.csv"
              columns={[
                { key: 'item', label: 'Item' },
                { key: 'batchNumber', label: 'Batch' },
                { key: 'quantity', label: 'Qty' },
                { key: 'expiryDate', label: 'Expiry', date: true },
                { key: 'expired', label: 'Expired' },
              ]}
            />

            <ReportTable
              title="Inventory ledger"
              rows={data.rows}
              filename="inventory-ledger.csv"
              columns={[
                { key: 'item', label: 'Item' },
                { key: 'type', label: 'Type' },
                { key: 'quantity', label: 'Qty' },
                { key: 'reason', label: 'Reason' },
                { key: 'date', label: 'Date', date: true },
              ]}
            />

            <ReportTable
              title="Purchase orders"
              rows={data.purchaseRows}
              filename="inventory-purchases.csv"
              columns={[
                { key: 'supplier', label: 'Supplier' },
                { key: 'status', label: 'Status' },
                { key: 'quantity', label: 'Qty' },
                { key: 'value', label: 'Value', money: true },
                { key: 'date', label: 'Date', date: true },
              ]}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

export default function InventoryReportPage() {
  return (
    <Protected requireModule="REPORTS" allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'INVENTORY_MGR']} requirePermission={['reports.read', 'reports.inventory.read', 'inventory.reports.read', 'inventory.read']}>
      <InventoryReportPageInner />
    </Protected>
  );
}
