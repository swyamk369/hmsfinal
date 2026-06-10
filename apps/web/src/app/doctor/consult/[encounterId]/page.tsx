'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, CheckCircle2, Plus, Printer, Lock, AlertTriangle } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { opdApi, type EncounterDetail } from '@/lib/opd';
import { getActiveMembership } from '@/lib/access';
import { labApi, type LabOrder, type LabTestCatalog } from '@/lib/lab';
import { ageFromDob, formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  Badge,
  cx,
} from '@/components/ui';

const TABS = ['History', 'Vitals', 'Diagnosis', 'Notes', 'Prescription', 'Lab', 'Follow-up'] as const;
type Tab = (typeof TABS)[number];

function Consult({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const membership = getActiveMembership(profile, activeTenantId);
  const hasLab = membership?.modules.includes('LAB') ?? false;
  const canLabOrder = membership?.permissions.includes('lab.order') ?? false;
  const router = useRouter();
  const toast = useToast();
  const [enc, setEnc] = useState<EncounterDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Vitals');
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setEnc(await opdApi.detail(t, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!enc) return <Spinner label="Loading consultation…" />;

  const inProgress = enc.status === 'IN_PROGRESS';
  const canVitals = ['CHECKED_IN', 'IN_PROGRESS'].includes(enc.status);
  const latestVitals = enc.vitals[0];

  async function startConsult() {
    setBusy(true);
    try {
      await opdApi.start(t, id);
      await load();
      toast.success('Consultation started.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        href="/doctor"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </Link>

      {/* Encounter header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-5 py-3">
        <div className="flex items-center gap-3">
          <StatusChip status={enc.status} />
          <span className="text-title-lg text-ink">{enc.patient.fullName}</span>
          <span className="text-body-sm text-ink-soft">Token #{enc.tokenNumber ?? '—'}</span>
        </div>
        <div className="flex gap-2">
          {enc.status === 'CHECKED_IN' && (
            <Button icon={Play} onClick={startConsult} loading={busy}>
              Start consultation
            </Button>
          )}
          {inProgress && (
            <Button icon={CheckCircle2} onClick={() => setCompleteOpen(true)}>
              Complete consultation
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Patient sidebar */}
        <aside className="space-y-4">
          <Section title="Patient">
            <div className="space-y-2 px-5 py-4 text-body-sm">
              <div className="text-title-lg text-ink">{enc.patient.fullName}</div>
              <div className="text-ink-soft">MRN {enc.patient.mrn}</div>
              <div className="text-ink-soft">
                {ageFromDob(enc.patient.dob)} · {enc.patient.sex ?? '—'}
              </div>
              <Link
                href={`/patients/${enc.patientId}`}
                className="text-label-sm font-medium text-primary hover:underline"
              >
                View full chart →
              </Link>
            </div>
          </Section>
          {enc.patient.allergies?.length > 0 && (
            <Section title="Allergies">
              <ul className="space-y-2 px-5 py-4">
                {enc.patient.allergies.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-body-sm text-danger-fg"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      <span className="font-semibold uppercase">{a.substance}</span>
                      {a.severity ? ` · ${a.severity}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Latest vitals">
            {latestVitals ? (
              <div className="grid grid-cols-2 gap-2 px-5 py-4 text-body-sm">
                <Vital
                  label="BP"
                  value={
                    latestVitals.systolicBp ? `${latestVitals.systolicBp}/${latestVitals.diastolicBp ?? '—'}` : '—'
                  }
                />
                <Vital label="HR" value={latestVitals.pulse ?? '—'} />
                <Vital label="SpO₂" value={latestVitals.spo2 ? `${latestVitals.spo2}%` : '—'} />
                <Vital label="Temp" value={latestVitals.temperature ? `${latestVitals.temperature}°` : '—'} />
              </div>
            ) : (
              <p className="px-5 py-4 text-body-sm text-ink-soft">No vitals recorded.</p>
            )}
          </Section>
        </aside>

        {/* Workspace */}
        <div>
          <div className="mb-4 -mx-1 flex gap-1 overflow-x-auto border-b border-line pb-px">
            {TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cx(
                  'whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-body-sm font-medium transition',
                  tab === tb ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {tb}
              </button>
            ))}
          </div>

          {!inProgress && enc.status === 'COMPLETED' && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-line bg-canvas px-4 py-2 text-body-sm text-ink-soft">
              <Lock className="h-4 w-4" /> This consultation is completed and read-only.
            </div>
          )}

          {tab === 'History' && (
            <Section title="Encounter & complaint">
              <div className="space-y-2 px-5 py-4 text-body-sm">
                <div>
                  <span className="text-ink-soft">Chief complaint:</span>{' '}
                  <span className="text-ink">{enc.chiefComplaint || '—'}</span>
                </div>
                <div>
                  <span className="text-ink-soft">Started:</span> {formatDateTime(enc.startedAt)}
                </div>
                <div>
                  <span className="text-ink-soft">Type:</span> {enc.type}
                </div>
              </div>
            </Section>
          )}

          {tab === 'Vitals' && <VitalsTab enc={enc} canEdit={canVitals} onSaved={load} />}
          {tab === 'Diagnosis' && <DiagnosisTab enc={enc} canEdit={inProgress} onSaved={load} />}
          {tab === 'Notes' && <NotesTab enc={enc} canEdit={inProgress} onSaved={load} />}
          {tab === 'Prescription' && <PrescriptionTab enc={enc} canEdit={inProgress} onSaved={load} />}
          {tab === 'Lab' && (
            <LabTab encounterId={enc.id} tenantId={t} hasLab={hasLab} canOrder={canLabOrder && inProgress} />
          )}
          {tab === 'Follow-up' && (
            <Section title="Follow-up">
              <div className="px-5 py-4 text-body-sm">
                {enc.followUpDate ? (
                  <>
                    <div>
                      <span className="text-ink-soft">Follow-up date:</span> {formatDateTime(enc.followUpDate)}
                    </div>
                    {enc.followUpNotes && <p className="mt-1 text-ink-muted">{enc.followUpNotes}</p>}
                  </>
                ) : (
                  <p className="text-ink-soft">Set follow-up when completing the consultation.</p>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>

      <CompleteModal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onConfirm={async (dto) => {
          await opdApi.complete(t, id, dto);
          toast.success('Consultation completed.');
          router.push('/doctor');
        }}
      />
    </>
  );
}

function LabTab({
  encounterId,
  tenantId,
  hasLab,
  canOrder,
}: {
  encounterId: string;
  tenantId: string;
  hasLab: boolean;
  canOrder: boolean;
}) {
  const toast = useToast();
  const [orders, setOrders] = useState<LabOrder[] | null>(null);
  const [catalog, setCatalog] = useState<LabTestCatalog[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasLab) return;
    setErr(null);
    try {
      const o = await labApi.encounterOrders(tenantId, encounterId);
      setOrders(o);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [tenantId, encounterId, hasLab]);

  useEffect(() => {
    void load();
    if (hasLab && canOrder)
      labApi
        .catalog(tenantId)
        .then(setCatalog)
        .catch(() => setCatalog([]));
  }, [load, hasLab, canOrder, tenantId]);

  if (!hasLab) {
    return (
      <EmptyState
        title="Lab module not enabled"
        hint="This hospital's plan does not include the Laboratory module. Upgrade to order tests."
        icon={AlertTriangle}
      />
    );
  }

  function toggle(idv: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(idv) ? next.delete(idv) : next.add(idv);
      return next;
    });
  }

  async function order() {
    if (picked.size === 0) {
      toast.error('Select at least one test.');
      return;
    }
    const tests = catalog.filter((c) => picked.has(c.id)).map((c) => ({ testId: c.id, testName: c.name }));
    setBusy(true);
    try {
      await labApi.orderFromEncounter(tenantId, encounterId, { notes: notes.trim() || undefined, tests });
      toast.success('Lab order placed.');
      setPicked(new Set());
      setNotes('');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {err && <ErrorState message={err} />}

      {canOrder && (
        <div className="rounded-lg border border-line p-4">
          <div className="mb-2 text-title-md text-ink">Order lab tests</div>
          {catalog.length === 0 ? (
            <p className="text-body-sm text-ink-soft">No lab tests configured in the catalog.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {catalog.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-body-sm hover:bg-canvas"
                  >
                    <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="text-ink">{c.name}</span>
                    <span className="ml-auto text-label-sm text-ink-soft">{c.code}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-end gap-3">
                <FormField label="Notes">
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </FormField>
                <Button icon={Plus} loading={busy} disabled={picked.size === 0} onClick={order}>
                  Place order
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {orders === null && <Spinner label="Loading lab orders…" />}
      {orders !== null && orders.length === 0 && <EmptyState title="No lab orders for this visit" />}
      {orders !== null &&
        orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-line p-4">
            <div className="mb-2 flex items-center justify-between">
              <Link href={`/lab/orders/${o.id}`} className="text-title-md text-ink hover:text-primary">
                {o.items.map((i) => i.testName).join(', ') || 'Lab order'}
              </Link>
              <StatusChip status={o.status} />
            </div>
            <ul className="space-y-1 text-body-sm">
              {o.items.map((it) => {
                const r = it.results[0];
                return (
                  <li key={it.id} className="flex items-center justify-between">
                    <span className="text-ink-muted">{it.testName}</span>
                    {r ? (
                      <span className="flex items-center gap-2">
                        <span className="text-ink">
                          {r.value ?? '—'} {r.unit}
                        </span>
                        <StatusChip status={r.isVerified ? 'VERIFIED' : r.abnormalFlag} />
                      </span>
                    ) : (
                      <span className="text-label-sm text-ink-soft">Pending</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}

function Vital({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-canvas px-3 py-2">
      <div className="text-label-sm text-ink-soft">{label}</div>
      <div className="text-title-lg text-ink">{value}</div>
    </div>
  );
}

function VitalsTab({
  enc,
  canEdit,
  onSaved,
}: {
  enc: EncounterDetail;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const num = (k: string) => (v[k] ? Number(v[k]) : undefined);
      await opdApi.addVitals(activeTenantId!, enc.id, {
        systolicBp: num('systolicBp') as any,
        diastolicBp: num('diastolicBp') as any,
        pulse: num('pulse') as any,
        spo2: num('spo2') as any,
        temperature: num('temperature') as any,
        respiratoryRate: num('respiratoryRate') as any,
        weightKg: num('weightKg') as any,
        heightCm: num('heightCm') as any,
        notes: v.notes || undefined,
      } as any);
      setV({});
      toast.success('Vitals recorded.');
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const F = ({ k, label }: { k: string; label: string }) => (
    <FormField label={label}>
      <Input
        inputMode="decimal"
        value={v[k] ?? ''}
        onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))}
        disabled={!canEdit}
      />
    </FormField>
  );

  return (
    <Section
      title="Vitals"
      action={
        canEdit ? (
          <Button size="sm" icon={Plus} onClick={save} loading={busy}>
            Record
          </Button>
        ) : undefined
      }
    >
      {canEdit && (
        <div className="grid grid-cols-2 gap-4 border-b border-line px-5 py-4 sm:grid-cols-4">
          <F k="systolicBp" label="Systolic" />
          <F k="diastolicBp" label="Diastolic" />
          <F k="pulse" label="Pulse" />
          <F k="spo2" label="SpO₂ %" />
          <F k="temperature" label="Temp °F" />
          <F k="respiratoryRate" label="Resp rate" />
          <F k="weightKg" label="Weight kg" />
          <F k="heightCm" label="Height cm" />
        </div>
      )}
      {enc.vitals.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState title="No vitals recorded" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {enc.vitals.map((vt) => (
            <li key={vt.id} className="flex items-center justify-between px-5 py-3 text-body-sm">
              <span className="text-ink">
                BP {vt.systolicBp ?? '—'}/{vt.diastolicBp ?? '—'} · HR {vt.pulse ?? '—'} · SpO₂ {vt.spo2 ?? '—'}% · Temp{' '}
                {vt.temperature ?? '—'}°
              </span>
              <span className="text-label-sm text-ink-soft">{formatDateTime(vt.recordedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DiagnosisTab({
  enc,
  canEdit,
  onSaved,
}: {
  enc: EncounterDetail;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ description: '', icdCode: '', type: 'PROVISIONAL', notes: '' });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!form.description.trim()) return;
    setBusy(true);
    try {
      await opdApi.addDiagnosis(activeTenantId!, enc.id, {
        description: form.description.trim(),
        icdCode: form.icdCode || undefined,
        type: form.type,
        notes: form.notes || undefined,
      });
      setForm({ description: '', icdCode: '', type: 'PROVISIONAL', notes: '' });
      toast.success('Diagnosis added.');
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Diagnosis"
      action={
        canEdit ? (
          <Button size="sm" icon={Plus} onClick={add} loading={busy} disabled={!form.description.trim()}>
            Add
          </Button>
        ) : undefined
      }
    >
      {canEdit && (
        <div className="space-y-3 border-b border-line px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <FormField label="Diagnosis">
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Acute bronchitis"
                />
              </FormField>
            </div>
            <FormField label="Type">
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="PROVISIONAL">Provisional</option>
                <option value="FINAL">Final</option>
                <option value="DIFFERENTIAL">Differential</option>
              </Select>
            </FormField>
          </div>
          <FormField label="ICD-10 code (optional)">
            <Input
              value={form.icdCode}
              onChange={(e) => setForm((f) => ({ ...f, icdCode: e.target.value }))}
              placeholder="J20.9"
            />
          </FormField>
        </div>
      )}
      {enc.diagnoses.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState title="No diagnoses recorded" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {enc.diagnoses.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <span className="font-medium text-ink">{d.description}</span>
                {d.icdCode && <span className="ml-2 font-mono text-label-sm text-ink-soft">{d.icdCode}</span>}
              </div>
              <Badge tone="slate">{d.type}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function NotesTab({ enc, canEdit, onSaved }: { enc: EncounterDetail; canEdit: boolean; onSaved: () => Promise<void> }) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('GENERAL');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await opdApi.addNote(activeTenantId!, enc.id, { content: content.trim(), noteType });
      setContent('');
      toast.success('Note saved.');
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Clinical notes"
      action={
        canEdit ? (
          <Button size="sm" icon={Plus} onClick={add} loading={busy} disabled={!content.trim()}>
            Save note
          </Button>
        ) : undefined
      }
    >
      {canEdit && (
        <div className="space-y-3 border-b border-line px-5 py-4">
          <FormField label="Note type">
            <Select className="w-48" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
              <option value="GENERAL">General</option>
              <option value="SOAP">SOAP</option>
              <option value="PROGRESS">Progress</option>
            </Select>
          </FormField>
          <Textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Consultation notes…"
          />
        </div>
      )}
      {enc.notes.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState title="No notes yet" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {enc.notes.map((n) => (
            <li key={n.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <Badge tone="slate">{n.noteType}</Badge>
                <span className="text-label-sm text-ink-soft">{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink-muted">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function PrescriptionTab({
  enc,
  canEdit,
  onSaved,
}: {
  enc: EncounterDetail;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const t = activeTenantId!;
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState({
    drugName: '',
    dosage: '',
    route: 'Oral (PO)',
    frequency: 'BID',
    duration: '',
    instructions: '',
    quantity: '',
  });
  const [busy, setBusy] = useState(false);

  function addItem() {
    if (!draft.drugName.trim()) return;
    setItems((x) => [...x, { ...draft, quantity: draft.quantity ? Number(draft.quantity) : 1 }]);
    setDraft({
      drugName: '',
      dosage: '',
      route: 'Oral (PO)',
      frequency: 'BID',
      duration: '',
      instructions: '',
      quantity: '',
    });
  }

  async function create() {
    if (items.length === 0) return;
    setBusy(true);
    try {
      await opdApi.createPrescription(t, enc.id, { items });
      setItems([]);
      toast.success('Prescription created (draft).');
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finalize(id: string) {
    try {
      await opdApi.finalizePrescription(t, id);
      toast.success('Prescription finalized.');
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <Section
          title="Build prescription"
          action={
            <Button size="sm" onClick={create} loading={busy} disabled={items.length === 0}>
              Create prescription ({items.length})
            </Button>
          }
        >
          <div className="space-y-3 border-b border-line px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FormField label="Drug">
                <Input
                  value={draft.drugName}
                  onChange={(e) => setDraft((d) => ({ ...d, drugName: e.target.value }))}
                  placeholder="Amoxicillin 500mg"
                />
              </FormField>
              <FormField label="Dosage">
                <Input
                  value={draft.dosage}
                  onChange={(e) => setDraft((d) => ({ ...d, dosage: e.target.value }))}
                  placeholder="1 tab"
                />
              </FormField>
              <FormField label="Route">
                <Select value={draft.route} onChange={(e) => setDraft((d) => ({ ...d, route: e.target.value }))}>
                  <option>Oral (PO)</option>
                  <option>IV</option>
                  <option>IM</option>
                  <option>Topical</option>
                </Select>
              </FormField>
              <FormField label="Frequency">
                <Select
                  value={draft.frequency}
                  onChange={(e) => setDraft((d) => ({ ...d, frequency: e.target.value }))}
                >
                  <option>QD</option>
                  <option>BID</option>
                  <option>TID</option>
                  <option>QID</option>
                  <option>PRN</option>
                </Select>
              </FormField>
              <FormField label="Duration">
                <Input
                  value={draft.duration}
                  onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))}
                  placeholder="7 days"
                />
              </FormField>
              <FormField label="Dispense qty">
                <Input
                  inputMode="numeric"
                  value={draft.quantity}
                  onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                  placeholder="14"
                />
              </FormField>
            </div>
            <FormField label="Instructions">
              <Input
                value={draft.instructions}
                onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
                placeholder="Take after meals"
              />
            </FormField>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" icon={Plus} onClick={addItem} disabled={!draft.drugName.trim()}>
                Add to list
              </Button>
            </div>
            {items.length > 0 && (
              <ul className="divide-y divide-line rounded-md border border-line">
                {items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2 text-body-sm">
                    <span className="text-ink">
                      {it.drugName} · {it.dosage} · {it.frequency} · {it.duration}
                    </span>
                    <button
                      className="text-label-sm text-danger hover:underline"
                      onClick={() => setItems((x) => x.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      <Section title="Prescriptions">
        {enc.prescriptions.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState title="No prescriptions yet" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {enc.prescriptions.map((rx) => (
              <li key={rx.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{rx.items.length} medication(s)</span>
                    <StatusChip status={rx.status} />
                  </div>
                  <div className="flex gap-2">
                    {rx.status === 'DRAFT' && (
                      <Button size="sm" onClick={() => finalize(rx.id)}>
                        Finalize
                      </Button>
                    )}
                    <Link href={`/prescriptions/${rx.id}`} target="_blank">
                      <Button size="sm" variant="ghost" icon={Printer}>
                        Print
                      </Button>
                    </Link>
                  </div>
                </div>
                <ul className="mt-1 list-disc pl-5 text-body-sm text-ink-muted">
                  {rx.items.map((it) => (
                    <li key={it.id}>
                      {it.drugName} · {it.dosage} · {it.frequency} · {it.duration}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function CompleteModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (dto: { followUpDate?: string; followUpNotes?: string }) => Promise<void>;
}) {
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setFollowUpDate('');
      setNotes('');
    }
  }, [open]);

  async function go() {
    setBusy(true);
    try {
      await onConfirm({ followUpDate: followUpDate || undefined, followUpNotes: notes.trim() || undefined });
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
      title="Complete consultation"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy}>
            Complete
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body-sm text-ink-muted">Completing locks the encounter. Add an optional follow-up.</p>
        <FormField label="Follow-up date">
          <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        </FormField>
        <FormField label="Follow-up notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export default function ConsultPage() {
  const params = useParams<{ encounterId: string }>();
  return (
    <Protected requireModule="OPD" allowedRoles={['DOCTOR', 'HOSPITAL_ADMIN']}>
      <Consult id={params.encounterId} />
    </Protected>
  );
}
