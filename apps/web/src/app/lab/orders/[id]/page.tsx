'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FlaskConical, Beaker, Printer, CheckCircle2, Play } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { labApi, ABNORMAL_FLAGS, type LabOrder, type LabOrderItem, type ResultEntry } from '@/lib/lab';
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

function OrderDetail({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const has = (p: string) => perms.has(p);

  const [order, setOrder] = useState<LabOrder | null>(null);
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
              <Button
                icon={Beaker}
                loading={busy}
                onClick={() => run('Sample collected.', () => labApi.collectSample(t, order.id))}
              >
                Collect sample
              </Button>
            )}
            {has('lab.result.enter') && order.status === 'SAMPLE_COLLECTED' && (
              <Button
                icon={Play}
                loading={busy}
                onClick={() => run('Order moved to processing.', () => labApi.setStatus(t, order.id, 'PROCESSING'))}
              >
                Mark processing
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusChip status={order.status} />
        {order.billing && order.billing.billed && (
          <span className="text-label-sm text-ink-soft">Billed: {order.billing.items} item(s)</span>
        )}
        {order.encounterId && (
          <Link href={`/doctor/consult/${order.encounterId}`} className="text-label-sm text-primary hover:underline">
            View encounter
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {order.items.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              orderStatus={order.status}
              canEnter={has('lab.result.enter') && isOpen}
              canVerify={has('lab.result.verify')}
              onSave={(entry) => run('Result saved.', () => labApi.enterResults(t, order.id, [entry]))}
              onVerify={(resultId) => run('Result verified.', () => labApi.verifyResult(t, resultId))}
              busy={busy}
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
                at={
                  order.items
                    .flatMap((i) => i.samples)
                    .map((s) => s.collectedAt)
                    .filter(Boolean)[0] ?? null
                }
                done={['SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED'].includes(order.status)}
              />
              <TimelineRow label="Processing" at={null} done={['PROCESSING', 'COMPLETED'].includes(order.status)} />
              <TimelineRow
                label="Completed / verified"
                at={
                  order.items
                    .flatMap((i) => i.results)
                    .map((r) => r.verifiedAt)
                    .filter(Boolean)[0] ?? null
                }
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
      <span
        className={done ? 'mt-1 h-2.5 w-2.5 rounded-full bg-success' : 'mt-1 h-2.5 w-2.5 rounded-full bg-slate-300'}
      />
      <div>
        <div className={done ? 'text-ink' : 'text-ink-soft'}>{label}</div>
        {at && <div className="text-label-sm text-ink-soft">{formatDateTime(at)}</div>}
      </div>
    </li>
  );
}

function ResultCard({
  item,
  orderStatus,
  canEnter,
  canVerify,
  onSave,
  onVerify,
  busy,
}: {
  item: LabOrderItem;
  orderStatus: string;
  canEnter: boolean;
  canVerify: boolean;
  onSave: (entry: ResultEntry) => Promise<void>;
  onVerify: (resultId: string) => Promise<void>;
  busy: boolean;
}) {
  const existing = item.results[0];
  const [value, setValue] = useState(existing?.value ?? '');
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [range, setRange] = useState(existing?.referenceRange ?? '');
  const [flag, setFlag] = useState(existing?.abnormalFlag ?? 'NORMAL');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const verified = existing?.isVerified;
  // Results can be entered once a sample exists and before the order is locked.
  const entryAllowed = canEnter && !verified && ['SAMPLE_COLLECTED', 'PROCESSING'].includes(orderStatus);

  return (
    <Section title={item.testName} action={<StatusChip status={item.status} />}>
      <div className="space-y-4 px-5 py-4">
        {entryAllowed ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FormField label="Value" required>
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 13.4" />
              </FormField>
              <FormField label="Unit">
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g/dL" />
              </FormField>
              <FormField label="Reference range">
                <Input value={range} onChange={(e) => setRange(e.target.value)} placeholder="12–16" />
              </FormField>
              <FormField label="Flag">
                <Select value={flag} onChange={(e) => setFlag(e.target.value as typeof flag)}>
                  {ABNORMAL_FLAGS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="col-span-2 sm:col-span-3">
                <FormField label="Notes">
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </FormField>
              </div>
            </div>
            <Button
              loading={busy}
              disabled={!value.trim()}
              onClick={() =>
                onSave({
                  labOrderItemId: item.id,
                  value: value.trim(),
                  unit: unit.trim() || undefined,
                  referenceRange: range.trim() || undefined,
                  abnormalFlag: flag,
                  notes: notes.trim() || undefined,
                })
              }
            >
              {existing ? 'Update result' : 'Save result'}
            </Button>
          </>
        ) : existing ? (
          <div className="space-y-2 text-body-sm">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-headline-sm text-ink">
                {existing.value ?? '—'} {existing.unit}
              </span>
              <StatusChip status={existing.abnormalFlag} />
              {existing.referenceRange && <span className="text-ink-soft">Ref: {existing.referenceRange}</span>}
              {verified ? (
                <span className="inline-flex items-center gap-1 text-success-fg">
                  <CheckCircle2 className="h-4 w-4" /> Verified{' '}
                  {existing.verifiedAt ? formatDateTime(existing.verifiedAt) : ''}
                </span>
              ) : (
                canVerify && (
                  <Button size="sm" icon={CheckCircle2} loading={busy} onClick={() => onVerify(existing.id)}>
                    Verify
                  </Button>
                )
              )}
            </div>
            {existing.notes && <p className="text-ink-muted">{existing.notes}</p>}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-body-sm text-ink-soft">
            <FlaskConical className="h-4 w-4" />
            {orderStatus === 'ORDERED'
              ? 'Collect the sample to begin.'
              : orderStatus === 'CANCELLED'
                ? 'Order cancelled.'
                : 'No result entered yet.'}
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
