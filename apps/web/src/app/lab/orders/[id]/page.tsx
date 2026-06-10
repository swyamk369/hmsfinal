'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FlaskConical, Beaker, Printer, CheckCircle2, Save } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { labApi, ABNORMAL_FLAGS, type AbnormalFlag, type LabOrder, type LabOrderItem } from '@/lib/lab';
import { formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  FormField,
  Input,
  Select,
  Textarea,
  PageHeader,
  StatusChip,
  Spinner,
  ErrorState,
} from '@/components/ui';

interface Entry {
  value: string;
  unit: string;
  range: string;
  flag: AbnormalFlag;
  notes: string;
}

function OrderDetail({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const has = (p: string) => perms.has(p);

  const [order, setOrder] = useState<LabOrder | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setOrder(await labApi.order(t, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Seed the editable panel from the order, preserving any unsaved edits across reloads.
  useEffect(() => {
    if (!order) return;
    setEntries((prev) => {
      const next: Record<string, Entry> = {};
      for (const item of order.items) {
        const ex = item.results[0];
        next[item.id] =
          prev[item.id] ??
          {
            value: ex?.value ?? '',
            unit: ex?.unit ?? '',
            range: ex?.referenceRange ?? '',
            flag: ex?.abnormalFlag ?? 'NORMAL',
            notes: ex?.notes ?? '',
          };
      }
      return next;
    });
  }, [order]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err) return <ErrorState message={err} />;
  if (!order) return <Spinner label="Loading lab order…" />;

  const isOpen = !['COMPLETED', 'CANCELLED'].includes(order.status);
  const canEnter = has('lab.result.enter') && isOpen && ['SAMPLE_COLLECTED', 'PROCESSING'].includes(order.status);
  const canVerify = has('lab.result.verify');
  const unverifiedCount = order.items.flatMap((i) => i.results).filter((r) => !r.isVerified).length;
  const enteredCount = order.items.filter((i) => i.results.length > 0).length;

  function setEntry(itemId: string, patch: Partial<Entry>) {
    setEntries((e) => ({ ...e, [itemId]: { ...e[itemId], ...patch } }));
  }

  async function saveAll() {
    const toSave = order!.items
      .filter((item) => entries[item.id]?.value.trim())
      .map((item) => {
        const e = entries[item.id];
        return {
          labOrderItemId: item.id,
          value: e.value.trim(),
          unit: e.unit.trim() || undefined,
          referenceRange: e.range.trim() || undefined,
          abnormalFlag: e.flag,
          notes: e.notes.trim() || undefined,
        };
      });
    if (toSave.length === 0) {
      toast.error('Enter at least one result value first.');
      return;
    }
    await run(`Saved ${toSave.length} result${toSave.length === 1 ? '' : 's'}.`, () => labApi.enterResults(t, order!.id, toSave));
  }

  return (
    <>
      <Link
        href="/lab"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to lab
      </Link>

      <PageHeader
        title={`Lab order · ${order.id.slice(0, 8)}`}
        subtitle={order.patient?.fullName ?? ''}
        action={
          <div className="flex flex-wrap gap-2">
            {has('lab.report.print') && (
              <Link href={`/lab/reports/${order.id}`}>
                <Button variant="ghost" icon={Printer}>
                  Report
                </Button>
              </Link>
            )}
            {has('lab.sample.collect') && order.status === 'ORDERED' && (
              <Button icon={Beaker} loading={busy} onClick={() => run('Sample collected.', () => labApi.collectSample(t, order.id))}>
                Collect sample
              </Button>
            )}
            {canEnter && (
              <Button icon={Save} loading={busy} onClick={saveAll}>
                Save all results
              </Button>
            )}
            {canVerify && unverifiedCount > 0 && order.status !== 'CANCELLED' && (
              <Button icon={CheckCircle2} loading={busy} onClick={() => run('Results verified.', () => labApi.verifyAll(t, order.id))}>
                Verify all &amp; complete
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusChip status={order.status} />
        <span className="text-label-sm text-ink-soft">
          {enteredCount}/{order.items.length} results entered
        </span>
        {order.billing && order.billing.billed && (
          <span className="text-label-sm text-ink-soft">Billed: {order.billing.items} item(s)</span>
        )}
        {order.encounterId && (
          <Link href={`/doctor/consult/${order.encounterId}`} className="text-label-sm text-primary hover:underline">
            View encounter
          </Link>
        )}
      </div>

      {order.status === 'ORDERED' && (
        <div className="mb-5 rounded-md border border-line bg-canvas px-4 py-3 text-body-sm text-ink-muted">
          Collect the sample to start entering results — then fill the whole panel and use <strong>Save all results</strong>.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {order.items.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              entry={entries[item.id]}
              editable={canEnter}
              onChange={(patch) => setEntry(item.id, patch)}
            />
          ))}
        </div>

        <div className="space-y-6">
          <Section title="Patient">
            <div className="space-y-1 px-5 py-4 text-body-sm">
              <div className="text-title-lg text-ink">{order.patient?.fullName ?? '—'}</div>
              <div className="text-ink-muted">MRN {order.patient?.mrn ?? '—'}</div>
              {order.patient?.phone && <div className="text-ink-muted">{order.patient.phone}</div>}
              {order.patient?.id && (
                <Link href={`/patients/${order.patient.id}`} className="text-label-sm text-primary hover:underline">
                  Patient record
                </Link>
              )}
            </div>
          </Section>

          <Section title="Status timeline">
            <ul className="space-y-3 px-5 py-4 text-body-sm">
              <TimelineRow label="Ordered" at={order.createdAt} done />
              <TimelineRow
                label="Sample collected"
                at={order.items.flatMap((i) => i.samples).map((s) => s.collectedAt).filter(Boolean)[0] ?? null}
                done={['SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED'].includes(order.status)}
              />
              <TimelineRow label="Processing" at={null} done={['PROCESSING', 'COMPLETED'].includes(order.status)} />
              <TimelineRow
                label="Completed / verified"
                at={order.items.flatMap((i) => i.results).map((r) => r.verifiedAt).filter(Boolean)[0] ?? null}
                done={order.status === 'COMPLETED'}
              />
            </ul>
          </Section>

          {order.notes && (
            <Section title="Order notes">
              <p className="px-5 py-4 text-body-sm text-ink-muted">{order.notes}</p>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function TimelineRow({ label, at, done }: { label: string; at: string | null; done: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span className={done ? 'mt-1 h-2.5 w-2.5 rounded-full bg-success' : 'mt-1 h-2.5 w-2.5 rounded-full bg-slate-300'} />
      <div>
        <div className={done ? 'text-ink' : 'text-ink-soft'}>{label}</div>
        {at && <div className="text-label-sm text-ink-soft">{formatDateTime(at)}</div>}
      </div>
    </li>
  );
}

function ResultCard({
  item,
  entry,
  editable,
  onChange,
}: {
  item: LabOrderItem;
  entry?: Entry;
  editable: boolean;
  onChange: (patch: Partial<Entry>) => void;
}) {
  const existing = item.results[0];
  const verified = existing?.isVerified ?? false;
  // Editable until the result is verified (and the order is open).
  const showForm = editable && !verified;
  const e = entry ?? { value: '', unit: '', range: '', flag: 'NORMAL' as AbnormalFlag, notes: '' };

  return (
    <Section title={item.testName} action={<StatusChip status={item.status} />}>
      <div className="space-y-4 px-5 py-4">
        {showForm ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <FormField label="Value" required>
              <Input value={e.value} onChange={(ev) => onChange({ value: ev.target.value })} placeholder="e.g. 13.4" />
            </FormField>
            <FormField label="Unit">
              <Input value={e.unit} onChange={(ev) => onChange({ unit: ev.target.value })} placeholder="g/dL" />
            </FormField>
            <FormField label="Reference range">
              <Input value={e.range} onChange={(ev) => onChange({ range: ev.target.value })} placeholder="12–16" />
            </FormField>
            <FormField label="Flag">
              <Select value={e.flag} onChange={(ev) => onChange({ flag: ev.target.value as AbnormalFlag })}>
                {ABNORMAL_FLAGS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="col-span-2 sm:col-span-3">
              <FormField label="Notes">
                <Textarea rows={2} value={e.notes} onChange={(ev) => onChange({ notes: ev.target.value })} />
              </FormField>
            </div>
          </div>
        ) : existing ? (
          <div className="space-y-2 text-body-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-headline-sm text-ink">
                {existing.value ?? '—'} {existing.unit}
              </span>
              <StatusChip status={existing.abnormalFlag} />
              {existing.referenceRange && <span className="text-ink-soft">Ref: {existing.referenceRange}</span>}
              {verified && (
                <span className="inline-flex items-center gap-1 text-success-fg">
                  <CheckCircle2 className="h-4 w-4" /> Verified {existing.verifiedAt ? formatDateTime(existing.verifiedAt) : ''}
                </span>
              )}
            </div>
            {existing.notes && <p className="text-ink-muted">{existing.notes}</p>}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-body-sm text-ink-soft">
            <FlaskConical className="h-4 w-4" /> No result entered yet.
          </p>
        )}
      </div>
    </Section>
  );
}

export default function LabOrderPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="LAB" allowedRoles={['LAB_TECH', 'DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}>
      <OrderDetail id={params.id} />
    </Protected>
  );
}
