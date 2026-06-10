'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, Printer, Upload } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type PatientAccount } from '@/lib/finance';
import { patientsApi } from '@/lib/patients';
import { ageFromDob, formatDateTime, money } from '@/lib/format';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Section,
  Select,
  Spinner,
  StatCard,
  StatusChip,
  Textarea,
} from '@/components/ui';
import { BillTable, ChargeTable, FinanceShell, FINANCE_PERMS } from '../../finance-ui';

function PatientAccountPageInner({ patientId }: { patientId: string }) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [data, setData] = useState<PatientAccount | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await financeApi.patientAccount(t, patientId));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [patientId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const claimOutstanding = useMemo(() => {
    return (data?.claims ?? []).reduce((sum: number, claim: any) => {
      const approved = claim.approvedAmount ?? 0;
      const settled = (claim.settlements ?? []).reduce((s: number, row: any) => s + row.amount, 0);
      return sum + Math.max(0, approved - settled);
    }, 0);
  }, [data]);

  if (err) return <ErrorState message={err} />;
  if (!data) return <Spinner label="Loading patient account..." />;

  return (
    <>
      <Link href="/finance" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to finance
      </Link>
      <PageHeader
        title="Patient Account"
        subtitle={`${data.patient.fullName} · ${data.patient.mrn} · ${ageFromDob(data.patient.dob)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" icon={Printer} onClick={() => window.print()}>Statement</Button>
            <Button icon={Upload} onClick={() => setDocumentOpen(true)}>Attach document</Button>
          </div>
        }
      />
      <FinanceShell>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pending charges" value={money(data.totals.pendingCharges)} />
            <StatCard label="Outstanding balance" value={money(data.totals.outstanding)} />
            <StatCard label="Paid" value={money(data.totals.paid)} />
            <StatCard label="Insurance receivable" value={money(claimOutstanding)} />
          </div>

          <Section title="Patient details">
            <dl className="grid gap-3 px-5 py-4 text-body-sm sm:grid-cols-2 lg:grid-cols-4">
              <Row label="MRN" value={data.patient.mrn} />
              <Row label="Phone" value={data.patient.phone ?? '-'} />
              <Row label="Email" value={data.patient.email ?? '-'} />
              <Row label="Address" value={data.patient.address ?? '-'} />
            </dl>
          </Section>

          <Section
            title="Pending charges"
            action={
              data.pendingCharges.length ? (
                <Link href={`/finance/pending-charges?patientId=${patientId}`}>
                  <Button size="sm" variant="ghost">Create bill</Button>
                </Link>
              ) : undefined
            }
          >
            {data.pendingCharges.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No pending charges" hint="OPD, lab, pharmacy, IPD, and manual charges appear here before billing." />
              </div>
            ) : (
              <ChargeTable charges={data.pendingCharges} />
            )}
          </Section>

          <Section title="Bills">
            {data.bills.length === 0 ? (
              <div className="p-5"><EmptyState title="No bills yet" /></div>
            ) : (
              <BillTable bills={data.bills} />
            )}
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Insurance claims">
              {data.claims.length === 0 ? (
                <div className="p-5"><EmptyState title="No insurance claims" /></div>
              ) : (
                <ul className="divide-y divide-line">
                  {data.claims.map((claim: any) => (
                    <li key={claim.id} className="flex items-center justify-between px-5 py-3 text-body-sm">
                      <div>
                        <Link href={`/insurance/claims/${claim.id}`} className="font-medium text-primary hover:underline">
                          {claim.bill?.billNumber ?? claim.id.slice(0, 8)}
                        </Link>
                        <div className="text-label-sm text-ink-soft">{claim.patientPolicy?.provider?.name ?? 'Insurance'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-ink">{money(claim.claimAmount ?? 0)}</div>
                        <StatusChip status={claim.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Finance documents">
              {data.documents.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={FileText} title="No finance documents" hint="Attach estimates, scanned receipts, payer forms, and generated statements." />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {data.documents.map((doc: any) => (
                    <li key={doc.id} className="flex items-center justify-between px-5 py-3 text-body-sm">
                      <div>
                        <a href={doc.documentUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                          {doc.title}
                        </a>
                        <div className="text-label-sm text-ink-soft">{formatDateTime(doc.createdAt)}</div>
                      </div>
                      <Badge tone="primary">{String(doc.category).replace(/_/g, ' ')}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </FinanceShell>

      <FinanceDocumentModal
        open={documentOpen}
        patientId={patientId}
        onClose={() => setDocumentOpen(false)}
        onSaved={async () => {
          toast.success('Finance document attached.');
          await load();
        }}
      />
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

function FinanceDocumentModal({
  open,
  patientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  patientId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('BILLING');
  const [documentUrl, setDocumentUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setCategory('BILLING');
      setDocumentUrl('');
      setFileName('');
      setMimeType('');
      setNotes('');
    }
  }, [open]);

  async function submit() {
    if (!activeTenantId || !title.trim() || !documentUrl.trim()) return;
    setBusy(true);
    try {
      await patientsApi.attachDocument(activeTenantId, patientId, {
        title: title.trim(),
        category: category as any,
        documentUrl: documentUrl.trim(),
        fileName: fileName.trim() || undefined,
        mimeType: mimeType.trim() || undefined,
        notes: notes.trim() || undefined,
      });
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
      title="Attach finance document"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={!title.trim() || !documentUrl.trim()}>Attach</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </FormField>
        <FormField label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="BILLING">Billing</option>
            <option value="INSURANCE">Insurance</option>
            <option value="GENERATED_REPORT">Generated report</option>
            <option value="OTHER">Other</option>
          </Select>
        </FormField>
        <FormField label="Document URL" required hint="Use a storage URL for PDFs, scanned images, payer documents, or exported statements.">
          <Input value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder="https://..." />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="File name">
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </FormField>
          <FormField label="MIME type">
            <Input value={mimeType} onChange={(e) => setMimeType(e.target.value)} placeholder="application/pdf" />
          </FormField>
        </div>
        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export default function FinancePatientAccountPage() {
  const params = useParams<{ patientId: string }>();
  return (
    <Protected requireModule="BILLING" requirePermission={['finance.patient_account.read', ...FINANCE_PERMS]}>
      <PatientAccountPageInner patientId={params.patientId} />
    </Protected>
  );
}
