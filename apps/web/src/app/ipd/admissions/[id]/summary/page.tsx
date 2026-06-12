'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { ipdApi, type DischargeSummaryView } from '@/lib/ipd';
import { ageFromDob, formatDate, formatDateTime, money } from '@/lib/format';
import { Button, ErrorState, Spinner, StatusChip } from '@/components/ui';

function SummaryInner({ id }: { id: string }) {
  const { activeTenantId } = useAuth();
  const [view, setView] = useState<DischargeSummaryView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    ipdApi
      .summary(activeTenantId, id)
      .then(setView)
      .catch((e) => setErr((e as Error).message));
  }, [activeTenantId, id]);

  if (err) return <ErrorState message={err} />;
  if (!view) return <Spinner label="Loading discharge summary..." />;

  const { admission, hospital, diagnoses } = view;
  const billTotal = admission.charges.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/ipd/admissions/${id}`}
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to admission
        </Link>
        <Button icon={Printer} onClick={() => window.print()}>
          Print summary
        </Button>
      </div>

      <article className="rounded-lg border border-line bg-surface p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-line pb-5">
          <div>
            <h1 className="text-headline-md text-ink">{hospital.name}</h1>
            {hospital.address && <p className="text-body-sm text-ink-soft">{hospital.address}</p>}
            {hospital.phone && <p className="text-body-sm text-ink-soft">Phone: {hospital.phone}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-display-lg text-ink">DISCHARGE SUMMARY</h2>
            <div className="mt-1 inline-flex justify-end">
              <StatusChip status={admission.status} />
            </div>
          </div>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <Box title="Patient details">
            <Row label="Name" value={admission.patient.fullName} />
            <Row label="MRN" value={admission.patient.mrn} />
            <Row label="Age / sex" value={`${ageFromDob(admission.patient.dob)} / ${admission.patient.sex ?? '-'}`} />
            <Row label="Phone" value={admission.patient.phone ?? '-'} />
            <Row
              label="Allergies"
              value={
                admission.patient.allergies.length
                  ? admission.patient.allergies.map((a) => a.substance).join(', ')
                  : 'None recorded'
              }
            />
          </Box>
          <Box title="Admission details">
            <Row label="Admission ID" value={admission.id.slice(0, 8)} />
            <Row label="Admitted" value={formatDateTime(admission.admittedAt)} />
            <Row label="Discharged" value={formatDateTime(admission.dischargedAt)} />
            <Row label="Ward / bed" value={`${admission.bed.ward.name} / ${admission.bed.bedNumber}`} />
            <Row label="Attending doctor" value={admission.providerName ?? 'Unassigned'} />
          </Box>
        </section>

        <DocSection title="Diagnoses">
          {diagnoses.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {diagnoses.map((d) => (
                <li key={d.id}>
                  {d.description}
                  {d.icdCode ? ` (${d.icdCode})` : ''} - {d.type}
                </li>
              ))}
            </ul>
          ) : (
            <Muted>No diagnoses recorded for the IPD encounter.</Muted>
          )}
        </DocSection>

        <DocSection title="Rounds">
          {admission.rounds.length ? (
            <Timeline rows={admission.rounds.map((r) => ({ id: r.id, at: r.createdAt, body: r.notes }))} />
          ) : (
            <Muted>No doctor rounds recorded.</Muted>
          )}
        </DocSection>

        <DocSection title="Nursing notes">
          {admission.nursingNotes.length ? (
            <Timeline rows={admission.nursingNotes.map((n) => ({ id: n.id, at: n.createdAt, body: n.note }))} />
          ) : (
            <Muted>No nursing notes recorded.</Muted>
          )}
        </DocSection>

        <DocSection title="Medications">
          {admission.medications.length ? (
            <Table
              heads={['Time', 'Status', 'Reference', 'Notes']}
              rows={admission.medications.map((m) => [
                formatDateTime(m.administeredAt),
                m.status,
                m.prescriptionItemId ?? '-',
                m.notes ?? '-',
              ])}
            />
          ) : (
            <Muted>No medication administrations recorded.</Muted>
          )}
        </DocSection>

        <DocSection title="Lab results">
          {admission.labOrders.length ? (
            <Table
              heads={['Order', 'Status', 'Ordered']}
              rows={admission.labOrders.map((o) => [
                `Order ${o.id.slice(0, 8)}`,
                o.status,
                formatDateTime(o.createdAt),
              ])}
            />
          ) : (
            <Muted>No lab orders linked to this admission.</Muted>
          )}
        </DocSection>

        <DocSection title="IPD charges">
          {admission.charges.length ? (
            <>
              <Table
                heads={['Description', 'Qty', 'Unit price', 'Total']}
                rows={admission.charges.map((c) => [
                  c.description,
                  String(c.quantity),
                  money(c.unitPrice, hospital.currency),
                  money(c.quantity * c.unitPrice, hospital.currency),
                ])}
              />
              <div className="mt-3 flex justify-end text-title-lg text-ink">
                Total IPD charges: {money(billTotal, hospital.currency)}
              </div>
            </>
          ) : (
            <Muted>No IPD charges recorded.</Muted>
          )}
        </DocSection>

        <DocSection title="Discharge details">
          <div className="space-y-3 text-body-sm">
            <Row label="Reason" value={admission.dischargeReason ?? '-'} />
            <Block label="Summary" value={admission.dischargeSummary?.summary ?? admission.dischargeNotes ?? '-'} />
            <Block
              label="Instructions"
              value={admission.dischargeSummary?.instructions ?? admission.dischargeNotes ?? '-'}
            />
            <Row label="Follow-up date" value={formatDate(admission.dischargeSummary?.followUpDate)} />
            <Row
              label="Prepared / finalized by"
              value={
                admission.dischargeSummary?.finalizedAt
                  ? `Finalized ${formatDateTime(admission.dischargeSummary.finalizedAt)}`
                  : 'Draft'
              }
            />
          </div>
        </DocSection>

        <footer className="mt-8 border-t border-line pt-4 text-center text-label-sm text-ink-soft">
          Generated securely via {hospital.name}. This summary is tenant-scoped and audit protected.
        </footer>
      </article>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line p-4 text-body-sm">
      <h3 className="mb-2 text-label-md uppercase text-ink-soft">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 border-b border-line pb-1 text-title-lg text-ink">{title}</h3>
      <div className="text-body-sm text-ink">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

function Block({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-label-sm uppercase text-ink-soft">{label}</div>
      <p className="whitespace-pre-wrap text-ink">{value}</p>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted">{children}</p>;
}

function Timeline({ rows }: { rows: { id: string; at: string; body: string }[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="text-label-sm uppercase text-ink-soft">{formatDateTime(row.at)}</div>
          <p className="whitespace-pre-wrap">{row.body}</p>
        </div>
      ))}
    </div>
  );
}

function Table({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className="border-b border-line text-label-md uppercase text-ink-soft">
            {heads.map((h) => (
              <th key={h} className="py-2 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={`${i}-${j}`} className="py-2 pr-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SummaryPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected
      requireModule="IPD"
      allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}
      requirePermission={['ipd.read']}
    >
      <SummaryInner id={params.id} />
    </Protected>
  );
}
