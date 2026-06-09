'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { labApi, type LabReport } from '@/lib/lab';
import { formatDate, formatDateTime } from '@/lib/format';
import { Button, Spinner, ErrorState } from '@/components/ui';

function ReportView({ id }: { id: string }) {
  const { activeTenantId } = useAuth();
  const [report, setReport] = useState<LabReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    labApi
      .report(activeTenantId, id)
      .then(setReport)
      .catch((e) => setErr((e as Error).message));
  }, [activeTenantId, id]);

  if (err) return <ErrorState message={err} />;
  if (!report) return <Spinner label="Loading report…" />;
  const { order, hospital } = report;
  const results = order.items.flatMap((it) => it.results.map((r) => ({ item: it, r })));
  const allVerified = results.length > 0 && results.every(({ r }) => r.isVerified);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/lab/orders/${id}`}
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to order
        </Link>
        <Button icon={Printer} onClick={() => window.print()}>
          Print report
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
            <h2 className="text-display-lg text-ink">LAB REPORT</h2>
            <div className="mt-1 inline-block rounded border border-line px-2 py-0.5 text-label-md uppercase text-ink-muted">
              {order.status}
            </div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-line p-4 text-body-sm">
            <div className="mb-1 text-label-sm uppercase text-ink-soft">Patient</div>
            <div className="text-title-lg text-ink">{order.patient?.fullName ?? '—'}</div>
            <div className="text-ink-muted">MRN {order.patient?.mrn ?? '—'}</div>
            {order.patient?.sex && <div className="text-ink-muted">Sex: {order.patient.sex}</div>}
          </div>
          <div className="rounded-md border border-line p-4 text-body-sm">
            <div className="mb-1 text-label-sm uppercase text-ink-soft">Order</div>
            <Row label="Order ID" value={order.id.slice(0, 8)} />
            <Row label="Ordered" value={formatDate(order.createdAt)} />
            <Row label="Tests" value={String(order.items.length)} />
          </div>
        </section>

        <table className="mt-6 w-full text-left text-body-sm">
          <thead>
            <tr className="border-b-2 border-line text-label-md uppercase text-ink-soft">
              <th className="py-2 pr-2">Test</th>
              <th className="py-2 pr-2">Result</th>
              <th className="py-2 pr-2">Unit</th>
              <th className="py-2 pr-2">Reference</th>
              <th className="py-2 text-right">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-soft">
                  No results recorded yet.
                </td>
              </tr>
            )}
            {results.map(({ item, r }) => {
              const abnormal = r.abnormalFlag !== 'NORMAL';
              return (
                <tr key={r.id} className={abnormal ? 'bg-danger-bg/40' : undefined}>
                  <td className="py-3 pr-2 text-ink">{r.testName || item.testName}</td>
                  <td className={abnormal ? 'py-3 pr-2 font-semibold text-danger-fg' : 'py-3 pr-2 font-medium text-ink'}>
                    {r.value ?? '—'}
                  </td>
                  <td className="py-3 pr-2 text-ink-muted">{r.unit ?? '—'}</td>
                  <td className="py-3 pr-2 text-ink-muted">{r.referenceRange ?? '—'}</td>
                  <td className="py-3 text-right">
                    <span className={abnormal ? 'font-semibold text-danger-fg' : 'text-ink-soft'}>
                      {r.abnormalFlag}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-8 flex items-end justify-between border-t border-line pt-5 text-body-sm">
          <div className="text-ink-soft">
            <div>Report generated {formatDateTime(new Date().toISOString())}</div>
            {allVerified ? (
              <div className="mt-1 font-medium text-success-fg">All results verified.</div>
            ) : (
              <div className="mt-1 font-medium text-warning-fg">Provisional — not all results verified.</div>
            )}
          </div>
          <div className="text-right">
            <div className="mb-8 text-ink-soft">Verified by</div>
            <div className="border-t border-line px-6 pt-1 text-ink-muted">Authorised signatory</div>
          </div>
        </div>

        <footer className="mt-8 border-t border-line pt-4 text-center text-label-sm text-ink-soft">
          This is a computer-generated laboratory report from {hospital.name}.
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

export default function LabReportPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="LAB" allowedRoles={['LAB_TECH', 'DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}>
      <ReportView id={params.id} />
    </Protected>
  );
}
