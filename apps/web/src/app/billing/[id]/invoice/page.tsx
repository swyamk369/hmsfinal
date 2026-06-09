'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { billingApi, type Invoice } from '@/lib/billing';
import { money, formatDate } from '@/lib/format';
import { Button, Spinner, ErrorState } from '@/components/ui';

function InvoiceView({ id }: { id: string }) {
  const { activeTenantId } = useAuth();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    billingApi
      .invoice(activeTenantId, id)
      .then(setInv)
      .catch((e) => setErr((e as Error).message));
  }, [activeTenantId, id]);

  if (err) return <ErrorState message={err} />;
  if (!inv) return <Spinner label="Loading invoice…" />;
  const { bill, hospital } = inv;
  const cur = hospital.currency;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/billing/${id}`}
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to bill
        </Link>
        <Button icon={Printer} onClick={() => window.print()}>
          Print invoice
        </Button>
      </div>

      <div className="rounded-lg border border-line bg-surface p-10 print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b-2 border-line pb-5">
          <div>
            <h1 className="text-headline-md text-ink">{hospital.name}</h1>
            {hospital.address && <p className="text-body-sm text-ink-soft">{hospital.address}</p>}
            {hospital.phone && <p className="text-body-sm text-ink-soft">Phone: {hospital.phone}</p>}
            {hospital.email && <p className="text-body-sm text-ink-soft">{hospital.email}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-display-lg text-ink">INVOICE</h2>
            <div className="mt-1 inline-block rounded border border-line px-2 py-0.5 text-label-md uppercase text-ink-muted">
              {bill.status}
            </div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-line p-4 text-body-sm">
            <div className="mb-1 text-label-sm uppercase text-ink-soft">Bill to</div>
            <div className="text-title-lg text-ink">{bill.patient?.fullName ?? '—'}</div>
            <div className="text-ink-muted">MRN {bill.patient?.mrn}</div>
            {bill.patient?.phone && <div className="text-ink-muted">{bill.patient.phone}</div>}
          </div>
          <div className="rounded-md border border-line p-4 text-body-sm">
            <div className="mb-1 text-label-sm uppercase text-ink-soft">Invoice details</div>
            <Row label="Invoice no" value={bill.billNumber} />
            <Row label="Date issued" value={formatDate(bill.createdAt)} />
          </div>
        </section>

        <table className="mt-6 w-full text-left text-body-sm">
          <thead>
            <tr className="border-b-2 border-line text-label-md uppercase text-ink-soft">
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Unit price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bill.items.map((it) => (
              <tr key={it.id}>
                <td className="py-3 pr-2 text-ink">{it.name}</td>
                <td className="py-3 pr-2 text-right text-ink-muted">{it.quantity}</td>
                <td className="py-3 pr-2 text-right text-ink-muted">{money(it.unitPrice, cur)}</td>
                <td className="py-3 text-right font-medium text-ink">{money(it.total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <div className="w-1/2 space-y-1 border-t border-line pt-3 text-body-sm">
            <Row label="Subtotal" value={money(bill.totalAmount, cur)} />
            <Row label="Discount" value={`− ${money(bill.discount, cur)}`} />
            <div className="flex justify-between border-t border-line py-2 text-title-lg font-semibold text-ink">
              <span>Net total</span>
              <span>{money(bill.netAmount, cur)}</span>
            </div>
            <Row label="Amount paid" value={`− ${money(inv.paid - inv.refunded, cur)}`} />
            <div className="flex justify-between rounded bg-canvas px-2 py-2 text-headline-sm text-ink">
              <span>Balance due</span>
              <span>{money(inv.balanceDue, cur)}</span>
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t border-line pt-5 text-center text-label-sm text-ink-soft">
          Generated securely via {hospital.name}. Thank you for trusting us with your care.
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="BILLING" allowedRoles={['BILLING', 'ACCOUNTANT', 'RECEPTION', 'HOSPITAL_ADMIN']}>
      <InvoiceView id={params.id} />
    </Protected>
  );
}
