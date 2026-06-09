'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Archive, Plus } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { patientsApi, type PatientTimeline } from '@/lib/patients';
import { money } from '@/lib/format';
import { ageFromDob, formatDate, formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  ReasonModal,
  FormField,
  Input,
  Select,
  Textarea,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  Badge,
  cx,
} from '@/components/ui';

const TABS = [
  'Overview',
  'Visits',
  'Appointments',
  'Prescriptions',
  'Bills',
  'Allergies',
  'History',
  'Consents',
] as const;
type Tab = (typeof TABS)[number];

function PatientDetail({ id }: { id: string }) {
  const { activeTenantId } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<PatientTimeline | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState<null | 'allergy' | 'history' | 'consent'>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      setData(await patientsApi.timeline(activeTenantId, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!data) return <Spinner label="Loading patient…" />;
  const p = data.patient;

  return (
    <>
      <Link
        href="/patients"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Link>

      <PageHeader
        title={p.fullName}
        subtitle={`${p.mrn} · ${ageFromDob(p.dob)} · ${p.sex ?? '—'}`}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" icon={Pencil} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            {!p.deletedAt && (
              <Button variant="danger" icon={Archive} onClick={() => setArchiveOpen(true)}>
                Archive
              </Button>
            )}
          </div>
        }
      />

      {p.deletedAt && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning-bg px-4 py-2 text-body-sm text-warning-fg">
          Archived: {p.archiveReason}
        </div>
      )}

      <div className="mb-6 -mx-1 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-body-sm font-medium transition',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t}
            {t === 'Visits' && data.encounters.length > 0 && ` (${data.encounters.length})`}
            {t === 'Bills' && data.bills.length > 0 && ` (${data.bills.length})`}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Demographics">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-body-sm">
              <Row label="MRN" value={p.mrn} />
              <Row label="DOB" value={formatDate(p.dob)} />
              <Row label="Phone" value={p.phone || '—'} />
              <Row label="Email" value={p.email || '—'} />
              <Row label="Address" value={p.address || '—'} />
              <Row
                label="Emergency"
                value={p.emergencyContactName ? `${p.emergencyContactName} · ${p.emergencyContactPhone ?? ''}` : '—'}
              />
            </dl>
          </Section>
          <Section title="Snapshot">
            <div className="grid grid-cols-2 gap-3 px-5 py-4 text-body-sm">
              <Stat label="Visits" value={data.encounters.length} />
              <Stat label="Appointments" value={data.appointments.length} />
              <Stat label="Prescriptions" value={data.prescriptions.length} />
              <Stat label="Bills" value={data.bills.length} />
              <Stat label="Allergies" value={data.allergies.length} />
              <Stat label="Lab orders" value={data.labOrders.length} />
            </div>
          </Section>
        </div>
      )}

      {tab === 'Visits' && (
        <ListSection
          empty="No OPD visits yet."
          rows={data.encounters}
          render={(e) => (
            <li key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="font-medium text-ink">
                  Token #{e.tokenNumber ?? '—'} · {e.chiefComplaint || 'Consultation'}
                </div>
                <div className="text-label-sm text-ink-soft">{formatDateTime(e.createdAt)}</div>
              </div>
              <StatusChip status={e.status} />
            </li>
          )}
        />
      )}

      {tab === 'Appointments' && (
        <ListSection
          empty="No appointments yet."
          rows={data.appointments}
          render={(a) => (
            <li key={a.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="font-medium text-ink">{a.reason || 'Appointment'}</div>
                <div className="text-label-sm text-ink-soft">{formatDateTime(a.scheduledAt)}</div>
              </div>
              <StatusChip status={a.status} />
            </li>
          )}
        />
      )}

      {tab === 'Prescriptions' && (
        <ListSection
          empty="No prescriptions yet."
          rows={data.prescriptions}
          render={(rx) => (
            <li key={rx.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-ink">{rx.items?.length ?? 0} medication(s)</div>
                <StatusChip status={rx.status} />
              </div>
              <div className="mt-1 text-label-sm text-ink-soft">{formatDateTime(rx.createdAt)}</div>
              <ul className="mt-1 list-disc pl-5 text-body-sm text-ink-muted">
                {(rx.items ?? []).map((it: any) => (
                  <li key={it.id}>
                    {it.drugName} {it.dosage ? `· ${it.dosage}` : ''} {it.frequency ? `· ${it.frequency}` : ''}
                  </li>
                ))}
              </ul>
            </li>
          )}
        />
      )}

      {tab === 'Bills' && (
        <ListSection
          empty="No bills yet."
          rows={data.bills}
          render={(b) => (
            <li key={b.id} className="flex items-center justify-between px-5 py-3">
              <Link href={`/billing/${b.id}`} className="font-mono text-body-sm text-primary hover:underline">
                {b.billNumber}
              </Link>
              <div className="flex items-center gap-3">
                <span className="font-medium text-ink">{money(b.netAmount)}</span>
                <StatusChip status={b.status} />
              </div>
            </li>
          )}
        />
      )}

      {tab === 'Allergies' && (
        <Section
          title="Allergies"
          action={
            <Button size="sm" icon={Plus} onClick={() => setAddOpen('allergy')}>
              Add
            </Button>
          }
        >
          {data.allergies.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState title="No allergies recorded" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.allergies.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <span className="font-medium text-ink">{a.substance}</span>
                    {a.notes && <span className="ml-2 text-body-sm text-ink-soft">{a.notes}</span>}
                  </div>
                  {a.severity && <Badge tone="danger">{a.severity}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === 'History' && (
        <Section
          title="Medical history"
          action={
            <Button size="sm" icon={Plus} onClick={() => setAddOpen('history')}>
              Add
            </Button>
          }
        >
          {data.histories.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState title="No history recorded" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.histories.map((h) => (
                <li key={h.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{h.type}</span>
                    <span className="text-label-sm text-ink-soft">{formatDate(h.recordedAt)}</span>
                  </div>
                  <p className="mt-0.5 text-body-sm text-ink-muted">{h.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === 'Consents' && (
        <Section
          title="Consents"
          action={
            <Button size="sm" icon={Plus} onClick={() => setAddOpen('consent')}>
              Add
            </Button>
          }
        >
          {data.consents.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState title="No consents recorded" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.consents.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-ink">{c.purpose}</span>
                  <span className="text-label-sm text-ink-soft">{formatDate(c.grantedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <EditModal open={editOpen} patient={p} onClose={() => setEditOpen(false)} onSaved={load} />
      <ReasonModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive patient"
        description={`${p.fullName} will be soft-archived. Records are retained for audit and can be reviewed.`}
        confirmLabel="Archive patient"
        onConfirm={async (reason) => {
          await patientsApi.archive(activeTenantId!, id, reason);
          toast.success('Patient archived.');
          router.push('/patients');
        }}
      />
      <AddSubModal kind={addOpen} patientId={id} onClose={() => setAddOpen(null)} onSaved={load} />
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
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="text-headline-md text-ink">{value}</div>
      <div className="text-label-sm text-ink-soft">{label}</div>
    </div>
  );
}
function ListSection({ rows, render, empty }: { rows: any[]; render: (r: any) => React.ReactNode; empty: string }) {
  return (
    <Section title={`${rows.length} record${rows.length === 1 ? '' : 's'}`}>
      {rows.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState title={empty} />
        </div>
      ) : (
        <ul className="divide-y divide-line">{rows.map(render)}</ul>
      )}
    </Section>
  );
}

function EditModal({
  open,
  patient,
  onClose,
  onSaved,
}: {
  open: boolean;
  patient: any;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', address: '', sex: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      setForm({
        fullName: patient.fullName,
        phone: patient.phone ?? '',
        email: patient.email ?? '',
        address: patient.address ?? '',
        sex: patient.sex ?? '',
      });
  }, [open, patient]);

  async function submit() {
    if (!activeTenantId) return;
    setBusy(true);
    try {
      await patientsApi.update(activeTenantId, patient.id, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        sex: form.sex || undefined,
      });
      toast.success('Patient updated.');
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
      title="Edit patient"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!form.fullName.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Full name" required>
          <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </FormField>
          <FormField label="Sex">
            <Select value={form.sex} onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}>
              <option value="">—</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </FormField>
        <FormField label="Address">
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </FormField>
      </div>
    </Modal>
  );
}

function AddSubModal({
  kind,
  patientId,
  onClose,
  onSaved,
}: {
  kind: null | 'allergy' | 'history' | 'consent';
  patientId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [a, setA] = useState({ substance: '', severity: '', notes: '' });
  const [h, setH] = useState({ type: '', description: '' });
  const [c, setC] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (kind) {
      setA({ substance: '', severity: '', notes: '' });
      setH({ type: '', description: '' });
      setC('');
    }
  }, [kind]);

  async function submit() {
    if (!activeTenantId || !kind) return;
    setBusy(true);
    try {
      if (kind === 'allergy')
        await patientsApi.addAllergy(activeTenantId, patientId, {
          substance: a.substance.trim(),
          severity: a.severity || undefined,
          notes: a.notes || undefined,
        });
      else if (kind === 'history')
        await patientsApi.addHistory(activeTenantId, patientId, {
          type: h.type.trim(),
          description: h.description.trim(),
        });
      else await patientsApi.addConsent(activeTenantId, patientId, c.trim());
      toast.success('Added.');
      await onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const valid =
    kind === 'allergy' ? a.substance.trim() : kind === 'history' ? h.type.trim() && h.description.trim() : c.trim();

  return (
    <Modal
      open={!!kind}
      onClose={onClose}
      title={kind === 'allergy' ? 'Add allergy' : kind === 'history' ? 'Add history' : 'Add consent'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!valid}>
            Add
          </Button>
        </>
      }
    >
      {kind === 'allergy' && (
        <div className="space-y-4">
          <FormField label="Substance" required>
            <Input
              value={a.substance}
              onChange={(e) => setA((x) => ({ ...x, substance: e.target.value }))}
              placeholder="Penicillin"
              autoFocus
            />
          </FormField>
          <FormField label="Severity">
            <Input
              value={a.severity}
              onChange={(e) => setA((x) => ({ ...x, severity: e.target.value }))}
              placeholder="Severe"
            />
          </FormField>
          <FormField label="Notes">
            <Textarea rows={2} value={a.notes} onChange={(e) => setA((x) => ({ ...x, notes: e.target.value }))} />
          </FormField>
        </div>
      )}
      {kind === 'history' && (
        <div className="space-y-4">
          <FormField label="Type" required>
            <Input
              value={h.type}
              onChange={(e) => setH((x) => ({ ...x, type: e.target.value }))}
              placeholder="Diabetes"
              autoFocus
            />
          </FormField>
          <FormField label="Description" required>
            <Textarea
              rows={3}
              value={h.description}
              onChange={(e) => setH((x) => ({ ...x, description: e.target.value }))}
            />
          </FormField>
        </div>
      )}
      {kind === 'consent' && (
        <FormField label="Purpose" required>
          <Input value={c} onChange={(e) => setC(e.target.value)} placeholder="Data processing & treatment" autoFocus />
        </FormField>
      )}
    </Modal>
  );
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="PATIENT">
      <PatientDetail id={params.id} />
    </Protected>
  );
}
