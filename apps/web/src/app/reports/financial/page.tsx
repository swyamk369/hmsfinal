'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, FileText, ReceiptText, ShieldCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import { Button, ErrorState, FormField, Input, PageHeader, Section, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, money } from '@/lib/format';
import { reportsApi, type FinancialReport } from '@/lib/reports';
import { Breakdown, KpiGrid, ReportTable } from '../report-ui';

function FinancialReportPageInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billStatus, setBillStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [data, setData] = useState<FinancialReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      startDate,
      endDate,
      billStatus,
      paymentMethod,
    }),
    [billStatus, endDate, paymentMethod, startDate],
  );

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await reportsApi.financial(t, params));
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
        title="Financial Report"
        subtitle={
          data
            ? `Billing, payments, refunds, receivables, and insurance · updated ${formatDateTime(data.generatedAt)}`
            : 'Billing, payments, refunds, receivables, and insurance'
        }
        action={
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        <Section title="Filters">
          <div className="grid gap-4 p-5 md:grid-cols-5">
            <FormField label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
            <FormField label="Bill status">
              <Select value={billStatus} onChange={(e) => setBillStatus(e.target.value)}>
                <option value="">All bill statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
                <option value="REFUNDED">Refunded</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </FormField>
            <FormField label="Payment method">
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">All methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="INSURANCE">Insurance</option>
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
          <Spinner label="Loading financial report..." />
        ) : data ? (
          <>
            <KpiGrid
              items={[
                { label: 'Billed', value: money(data.totals.totalBilled ?? 0), icon: ReceiptText },
                { label: 'Collected', value: money(data.totals.totalCollected ?? 0), icon: CreditCard },
                { label: 'Outstanding', value: money(data.totals.outstandingReceivables ?? 0), icon: Banknote },
                { label: 'Refunds', value: money(data.totals.refunds ?? 0), icon: FileText },
                {
                  label: 'Insurance approved',
                  value: money(data.totals.insuranceApproved ?? 0),
                  hint: `${money(data.totals.insuranceSettled ?? 0)} settled`,
                  icon: ShieldCheck,
                },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-3">
              <Breakdown title="Bill status" data={data.billStatus} />
              <Breakdown title="Payment method" data={data.paymentMethod} />
              <Breakdown title="Insurance status" data={data.insuranceStatus} />
            </div>

            <ReportTable
              title="Bills and receivables"
              rows={data.rows}
              filename="financial-bills.csv"
              columns={[
                { key: 'billNumber', label: 'Bill' },
                { key: 'patient', label: 'Patient' },
                { key: 'status', label: 'Status' },
                { key: 'billed', label: 'Billed', money: true },
                { key: 'collected', label: 'Collected', money: true },
                { key: 'refunded', label: 'Refunded', money: true },
                { key: 'outstanding', label: 'Outstanding', money: true },
                { key: 'date', label: 'Date', date: true },
              ]}
            />

            <ReportTable
              title="Insurance claim rows"
              rows={data.insuranceRows}
              filename="financial-insurance.csv"
              columns={[
                { key: 'billNumber', label: 'Bill' },
                { key: 'patient', label: 'Patient' },
                { key: 'status', label: 'Status' },
                { key: 'claimAmount', label: 'Claimed', money: true },
                { key: 'approvedAmount', label: 'Approved', money: true },
                { key: 'patientShare', label: 'Patient share', money: true },
                { key: 'settled', label: 'Settled', money: true },
                { key: 'date', label: 'Date', date: true },
              ]}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

export default function FinancialReportPage() {
  return (
    <Protected
      requireModule="REPORTS"
      allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'ACCOUNTANT', 'BILLING']}
      requirePermission={['reports.read', 'reports.financial.read', 'bill.read']}
    >
      <FinancialReportPageInner />
    </Protected>
  );
}
