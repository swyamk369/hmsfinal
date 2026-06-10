'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, HeartPulse, NotebookPen, Pill, Plus } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { MED_ADMIN_STATUSES, type AdmissionDetail, type MedAdmin, type NursingNote, type Vitals } from '@/lib/ipd';
import { nursingApi } from '@/lib/nursing';
import { ageFromDob, formatDateTime } from '@/lib/format';
import { Badge, Button, ErrorState, FormField, Input, Modal, PageHeader, Section, Select, Spinner, StatusChip, Textarea } from '@/components/ui';

function NursingAdmissionInner({ admissionId }: { admissionId: string }) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [admission, setAdmission] = useState<AdmissionDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [medModal, setMedModal] = useState<{ mode: 'add' } | { mode: 'edit'; med: MedAdmin } | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setAdmission(await nursingApi.getAdmission(t, admissionId));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, admissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = useMemo(() => {
    if (!admission) return [];
    return [
      ...admission.vitals.map((v) => ({ id: v.id, at: v.recordedAt, label: 'Vitals recorded', body: vitalsLine(v) })),
      ...admission.nursingNotes.map((n) => ({ id: n.id, at: n.createdAt, label: 'Nursing note', body: n.note })),
      ...admission.medications.map((m) => ({ id: m.id, at: m.administeredAt, label: `Medication ${m.status.toLowerCase()}`, body: m.notes ?? m.prescriptionItemId ?? 'Medication administration' })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [admission]);

  if (err) return <ErrorState message={err} />;
  if (!admission) return <Spinner label="Loading nursing chart..." />;

  const active = admission.status === 'ADMITTED';

  return (
    <>
      <Link href="/nursing" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to nursing
      </Link>

      <PageHeader
        title={admission.patient.fullName}
        subtitle={`${admission.patient.mrn} - ${admission.bed.ward.name} / ${admission.bed.bedNumber}`}
        action={<StatusChip status={admission.status} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Patient" value={`${ageFromDob(admission.patient.dob)} / ${admission.patient.sex ?? '-'}`} hint={admission.patient.phone ?? ''} />
        <Info label="Bed" value={`${admission.bed.ward.name} / ${admission.bed.bedNumber}`} hint={admission.bed.ward.type} />
        <Info label="Admitted" value={formatDateTime(admission.admittedAt)} hint={admission.providerName ?? 'No provider assigned'} />
        <Info label="Alerts" value={admission.patient.allergies.length ? `${admission.patient.allergies.length} allergy` : 'None'} hint={admission.patient.allergies.map((a) => a.substance).join(', ')} />
      </div>

      {!active && (
        <div className="mb-5 rounded-md border border-warning-bg bg-warning-bg px-4 py-3 text-body-sm text-warning-fg">
          This admission is no longer active. Existing nursing records are read-only here.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Record vitals" action={<Badge tone={active ? 'success' : 'slate'}>{active ? 'Active' : 'Read only'}</Badge>}>
            <VitalsForm disabled={!active} onSave={async (body) => {
              await nursingApi.addVitals(t, admissionId, body);
              toast.success('Vitals recorded.');
              await load();
            }} />
          </Section>

          <Section title="Nursing note">
            <NoteForm disabled={!active} onSave={async (note) => {
              await nursingApi.addNote(t, admissionId, note);
              toast.success('Nursing note added.');
              await load();
            }} />
          </Section>

          <Section
            title="Medication administration chart"
            action={active ? <Button size="sm" icon={Plus} onClick={() => setMedModal({ mode: 'add' })}>Administer</Button> : undefined}
          >
            <MedicationTable meds={admission.medications} disabled={!active} onEdit={(med) => setMedModal({ mode: 'edit', med })} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Care timeline">
            {timeline.length === 0 ? (
              <p className="px-5 py-8 text-center text-body-sm text-ink-soft">No nursing activity yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {timeline.slice(0, 20).map((row) => (
                  <div key={row.id} className="px-5 py-4">
                    <div className="text-body-sm font-medium text-ink">{row.label}</div>
                    <div className="text-label-sm text-ink-soft">{formatDateTime(row.at)}</div>
                    <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink-muted">{row.body}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Recent notes">
            <NoteList notes={admission.nursingNotes} />
          </Section>
        </div>
      </div>

      <MedicationModal
        state={medModal}
        onClose={() => setMedModal(null)}
        onSubmit={async (body) => {
          if (!medModal) return;
          if (medModal.mode === 'edit') {
            await nursingApi.updateMedication(t, medModal.med.id, body);
            toast.success('Medication administration updated.');
          } else {
            await nursingApi.addMedication(t, admissionId, body);
            toast.success('Medication administration recorded.');
          }
          setMedModal(null);
          await load();
        }}
      />
    </>
  );
}

function VitalsForm({ disabled, onSave }: { disabled: boolean; onSave: (body: Partial<Vitals>) => Promise<void> }) {
  const [form, setForm] = useState({ systolicBp: '', diastolicBp: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '', weightKg: '', heightCm: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    const body: Partial<Vitals> = {
      systolicBp: num(form.systolicBp),
      diastolicBp: num(form.diastolicBp),
      pulse: num(form.pulse),
      temperature: num(form.temperature),
      spo2: num(form.spo2),
      respiratoryRate: num(form.respiratoryRate),
      weightKg: num(form.weightKg),
      heightCm: num(form.heightCm),
      notes: form.notes.trim() || undefined,
    };
    if (!Object.values(body).some((v) => v !== null && v !== undefined && v !== '')) {
      setErr('Enter at least one vital or note.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(body);
      setForm({ systolicBp: '', diastolicBp: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '', weightKg: '', heightCm: '', notes: '' });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      {err && <ErrorState message={err} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Systolic BP">
          <Input type="number" value={form.systolicBp} onChange={(e) => set('systolicBp', e.target.value)} disabled={disabled} />
        </FormField>
        <FormField label="Diastolic BP">
          <Input type="number" value={form.diastolicBp} onChange={(e) => set('diastolicBp', e.target.value)} disabled={disabled} />
        </FormField>
        <FormField label="Pulse">
          <Input type="number" value={form.pulse} onChange={(e) => set('pulse', e.target.value)} disabled={disabled} />
        </FormField>
        <FormField label="SpO2">
          <Input type="number" value={form.spo2} onChange={(e) => set('spo2', e.target.value)} disabled={disabled} />
        </FormField>
        <FormField label="Temperature">
          <Input type="number" step="0.1" value={form.temperature} onChange={(e) => set('temperature', e.target.value)} disabled={disabled} />
        </FormField>
        <FormField label="Resp. rate">
          <Input type="number" value={form.respiratoryRate} onChange={(e) => set('respiratoryRate', e.target.value)} disabled={disabled} />
        </FormField>
        <FormField label="Weight kg">
          <Input type="number" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} disabled={disabled} />
        </FormField>
        <FormField label="Height cm">
          <Input type="number" step="0.1" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} disabled={disabled} />
        </FormField>
      </div>
      <FormField label="Notes">
        <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={disabled} placeholder="Pain score, mobility, oxygen, intake/output notes" />
      </FormField>
      <div className="flex justify-end">
        <Button icon={HeartPulse} onClick={submit} loading={busy} disabled={disabled}>Record vitals</Button>
      </div>
    </div>
  );
}

function NoteForm({ disabled, onSave }: { disabled: boolean; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!note.trim()) {
      setErr('Nursing note is required.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(note.trim());
      setNote('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 p-5">
      {err && <ErrorState message={err} />}
      <FormField label="Note" required>
        <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled} placeholder="Clinical observation, intervention, response, escalation" />
      </FormField>
      <div className="flex justify-end">
        <Button icon={NotebookPen} onClick={submit} loading={busy} disabled={disabled || !note.trim()}>Add nursing note</Button>
      </div>
    </div>
  );
}

function MedicationTable({ meds, disabled, onEdit }: { meds: MedAdmin[]; disabled: boolean; onEdit: (med: MedAdmin) => void }) {
  if (meds.length === 0) {
    return <p className="px-5 py-8 text-center text-body-sm text-ink-soft">No medication administrations recorded yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className="border-b border-line text-label-md uppercase text-ink-soft">
            <th className="px-5 py-3 font-medium">Time</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Reference</th>
            <th className="px-5 py-3 font-medium">Notes</th>
            <th className="px-5 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {meds.map((m) => (
            <tr key={m.id}>
              <td className="px-5 py-3 text-ink-muted">{formatDateTime(m.administeredAt)}</td>
              <td className="px-5 py-3"><StatusChip status={m.status} /></td>
              <td className="px-5 py-3 text-ink-muted">{m.prescriptionItemId ?? '-'}</td>
              <td className="px-5 py-3 text-ink-muted">{m.notes ?? '-'}</td>
              <td className="px-5 py-3 text-right">
                <Button size="sm" variant="ghost" onClick={() => onEdit(m)} disabled={disabled}>Update</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MedicationModal({ state, onClose, onSubmit }: { state: { mode: 'add' } | { mode: 'edit'; med: MedAdmin } | null; onClose: () => void; onSubmit: (body: { prescriptionItemId?: string; status?: string; notes?: string }) => Promise<void> }) {
  const open = !!state;
  const [prescriptionItemId, setPrescriptionItemId] = useState('');
  const [status, setStatus] = useState('ADMINISTERED');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setPrescriptionItemId(state.mode === 'edit' ? state.med.prescriptionItemId ?? '' : '');
    setStatus(state.mode === 'edit' ? state.med.status : 'ADMINISTERED');
    setNotes(state.mode === 'edit' ? state.med.notes ?? '' : '');
    setErr(null);
    setBusy(false);
  }, [state]);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        prescriptionItemId: state?.mode === 'add' && prescriptionItemId.trim() ? prescriptionItemId.trim() : undefined,
        status,
        notes: notes.trim() || undefined,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={state?.mode === 'edit' ? 'Update medication administration' : 'Administer medication'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button icon={CheckCircle2} onClick={submit} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        {state?.mode === 'add' && (
          <FormField label="Prescription item ID" hint="Optional link to a prescription item if available.">
            <Input value={prescriptionItemId} onChange={(e) => setPrescriptionItemId(e.target.value)} placeholder="Optional UUID" />
          </FormField>
        )}
        <FormField label="Administration status" required>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {MED_ADMIN_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dose, route, reason for refusal/hold, response" />
        </FormField>
      </div>
    </Modal>
  );
}

function NoteList({ notes }: { notes: NursingNote[] }) {
  if (notes.length === 0) return <p className="px-5 py-8 text-center text-body-sm text-ink-soft">No notes yet.</p>;
  return (
    <div className="divide-y divide-line">
      {notes.slice(0, 5).map((n) => (
        <div key={n.id} className="px-5 py-4">
          <div className="text-label-sm uppercase text-ink-soft">{formatDateTime(n.createdAt)}</div>
          <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink">{n.note}</p>
        </div>
      ))}
    </div>
  );
}

function Info({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-label-sm uppercase text-ink-soft">{label}</div>
      <div className="mt-1 min-h-6 text-title-lg text-ink">{value}</div>
      {hint && <div className="mt-1 truncate text-body-sm text-ink-muted">{hint}</div>}
    </div>
  );
}

function vitalsLine(v: Vitals): string {
  const parts = [
    `BP ${show(v.systolicBp)}/${show(v.diastolicBp)}`,
    `pulse ${show(v.pulse)}`,
    `SpO2 ${show(v.spo2)}%`,
    `temp ${show(v.temperature)} C`,
    `RR ${show(v.respiratoryRate)}/min`,
    `weight ${show(v.weightKg)} kg`,
    `height ${show(v.heightCm)} cm`,
  ];
  if (v.notes) parts.push(`notes: ${v.notes}`);
  return parts.join(', ');
}

function show(value: number | string | null | undefined): string {
  return value === null || value === undefined || value === '' ? '-' : String(value);
}

function num(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default function NursingAdmissionPage() {
  const params = useParams<{ admissionId: string }>();
  return (
    <Protected requireModule="IPD" allowedRoles={['NURSE', 'HOSPITAL_ADMIN']} requirePermission={['nursing.read']}>
      <NursingAdmissionInner admissionId={params.admissionId} />
    </Protected>
  );
}
