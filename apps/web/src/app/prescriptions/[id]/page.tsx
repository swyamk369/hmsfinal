'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { opdApi, type Prescription } from '@/lib/opd';
import { ageFromDob, formatDate } from '@/lib/format';
import { Button, Spinner, ErrorState } from '@/components/ui';

function RxPrint({ id }: { id: string }) {
  const { activeTenantId, activeMembership } = useAuth();
  const [rx, setRx] = useState<Prescription | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    opdApi
      .getPrescription(activeTenantId, id)
      .then(setRx)
      .catch((e) => setErr((e as Error).message));
  }, [activeTenantId, id]);

  if (err) return <ErrorState message={err} />;
  if (!rx) return <Spinner label="Loading prescription…" />;
  const patient = rx.encounter?.patient;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <Button icon={Printer} onClick={() => window.print()}>
          Print prescription
        </Button>
      </div>

      <div className="rounded-lg border border-line bg-surface p-10 print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b-2 border-line pb-5">
          <div>
            <h1 className="text-display-lg text-ink">{activeMembership?.tenantName ?? 'Hospital'}</h1>
            <p className="text-body-sm text-ink-soft">Prescription</p>
          </div>
          <div className="text-right text-body-sm text-ink-soft">
            <div>Date: {formatDate(rx.createdAt)}</div>
            <div>Status: {rx.status}</div>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-4 rounded-md border border-line p-4 text-body-sm">
          <div>
            <span className="text-ink-soft">Patient:</span>{' '}
            <span className="font-semibold text-ink">{patient?.fullName ?? '—'}</span>
          </div>
          <div>
            <span className="text-ink-soft">MRN:</span> {patient?.mrn ?? '—'}
          </div>
          <div>
            <span className="text-ink-soft">Age/Sex:</span> {ageFromDob(patient?.dob)} / {patient?.sex ?? '—'}
          </div>
        </section>

        <div className="mt-6 text-display-lg italic text-ink">℞</div>

        <table className="mt-2 w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Medication</th>
              <th className="py-2 pr-2">Dosage</th>
              <th className="py-2 pr-2">Duration</th>
              <th className="py-2">Instructions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rx.items.map((it, i) => (
              <tr key={it.id}>
                <td className="py-3 pr-2 align-top text-ink-soft">{i + 1}.</td>
                <td className="py-3 pr-2 align-top font-medium text-ink">
                  {it.drugName}
                  {it.route ? ` (${it.route})` : ''}
                </td>
                <td className="py-3 pr-2 align-top">{[it.dosage, it.frequency].filter(Boolean).join(' · ') || '—'}</td>
                <td className="py-3 pr-2 align-top">{it.duration || '—'}</td>
                <td className="py-3 align-top text-ink-muted">{it.instructions || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rx.notes && (
          <div className="mt-6 rounded-md border border-line bg-canvas p-4 text-body-sm">
            <div className="font-medium text-ink">Additional notes</div>
            <p className="mt-1 text-ink-muted">{rx.notes}</p>
          </div>
        )}

        <footer className="mt-10 flex items-end justify-between border-t border-line pt-6 text-label-sm text-ink-soft">
          <p className="max-w-xs">
            Digitally generated via {activeMembership?.tenantName ?? 'HMS'}. Valid for 30 days unless specified.
          </p>
          <div className="text-center">
            <div className="h-12 w-44 border-b border-line" />
            <div className="mt-1 uppercase">Doctor&apos;s signature</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function PrescriptionPrintPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="OPD" allowedRoles={['DOCTOR', 'HOSPITAL_ADMIN']}>
      <RxPrint id={params.id} />
    </Protected>
  );
}
