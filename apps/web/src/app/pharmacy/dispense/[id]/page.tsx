'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle, PackageCheck, RotateCcw, CheckCircle2 } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { pharmacyApi, type Availability, type PharmacyPrescription, type DispenseRecord } from '@/lib/pharmacy';
import { ageFromDob, money } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  ReasonModal,
  Input,
  Select,
  Spinner,
  ErrorState,
  StatusChip,
  Badge,
  cx,
} from '@/components/ui';

interface PlanRow {
  inventoryItemId: string;
  quantity: number;
}

function Dispense({ id }: { id: string }) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [rx, setRx] = useState<PharmacyPrescription | null>(null);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [record, setRecord] = useState<DispenseRecord | null>(null);
  const [plan, setPlan] = useState<Record<string, PlanRow>>({});
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const [r, a] = await Promise.all([pharmacyApi.getPrescription(t, id), pharmacyApi.availability(t, id)]);
      setRx(r);
      setAvail(a);
      // Seed the plan with the best-stocked match + the prescribed quantity.
      const seed: Record<string, PlanRow> = {};
      for (const line of a.lines) {
        const best = [...line.matches].sort((x, y) => y.available - x.available)[0];
        seed[line.prescriptionItemId] = { inventoryItemId: best?.inventoryItemId ?? '', quantity: line.requestedQty };
      }
      setPlan(seed);
      if (r.status === 'DISPENSED') {
        const list = await pharmacyApi.listDispenses(t);
        setRecord(list.find((d) => d.prescriptionId === id) ?? null);
      } else {
        setRecord(null);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const matchFor = useCallback(
    (prescriptionItemId: string, inventoryItemId: string) =>
      avail?.lines
        .find((l) => l.prescriptionItemId === prescriptionItemId)
        ?.matches.find((m) => m.inventoryItemId === inventoryItemId),
    [avail],
  );

  const billPreview = useMemo(() => {
    if (!avail) return 0;
    return avail.lines.reduce((sum, line) => {
      const p = plan[line.prescriptionItemId];
      if (!p?.inventoryItemId || p.quantity <= 0) return sum;
      const m = matchFor(line.prescriptionItemId, p.inventoryItemId);
      const price = m?.batches[0]?.salePrice ?? 0;
      return sum + p.quantity * price;
    }, 0);
  }, [avail, plan, matchFor]);

  const canDispense = useMemo(() => {
    if (!avail) return false;
    return avail.lines.every((line) => {
      const p = plan[line.prescriptionItemId];
      if (!p?.inventoryItemId || p.quantity <= 0) return false;
      const m = matchFor(line.prescriptionItemId, p.inventoryItemId);
      return (m?.available ?? 0) >= p.quantity;
    });
  }, [avail, plan, matchFor]);

  async function dispense() {
    if (!rx) return;
    setBusy(true);
    try {
      const items = avail!.lines
        .map((line) => ({ prescriptionItemId: line.prescriptionItemId, ...plan[line.prescriptionItemId] }))
        .filter((i) => i.inventoryItemId && i.quantity > 0);
      const result = await pharmacyApi.dispense(t, id, { items });
      toast.success('Dispensed and billed.');
      setConfirmOpen(false);
      setRecord(result);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err) return <ErrorState message={err} />;
  if (!rx || !avail) return <Spinner label="Loading prescription…" />;
  const patient = rx.encounter?.patient;
  const allergies = patient?.allergies ?? [];
  const dispensed = rx.status === 'DISPENSED';

  return (
    <>
      <Link
        href="/pharmacy"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to pharmacy
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-5 py-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-title-lg text-ink">{patient?.fullName ?? 'Patient'}</span>
            <StatusChip status={rx.status} />
          </div>
          <div className="text-label-sm text-ink-soft">
            MRN {patient?.mrn} · {ageFromDob(patient?.dob)} / {patient?.sex ?? '—'}
          </div>
        </div>
        <div className="flex gap-2">
          {!dispensed && (
            <Button icon={PackageCheck} disabled={!canDispense} onClick={() => setConfirmOpen(true)}>
              Verify &amp; dispense
            </Button>
          )}
          {dispensed && record && record.status !== 'CANCELLED' && (
            <Button variant="ghost" icon={RotateCcw} onClick={() => setReturnOpen(true)}>
              Return
            </Button>
          )}
          {dispensed && record?.billId && (
            <Link href={`/billing/${record.billId}`}>
              <Button variant="ghost">View bill</Button>
            </Link>
          )}
        </div>
      </div>

      {allergies.length > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-danger-fg">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-semibold">Allergy alert</div>
            <div className="text-body-sm">
              {allergies.map((a) => a.substance).join(', ')} — cross-check before dispensing.
            </div>
          </div>
        </div>
      )}

      {dispensed && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-success/30 bg-success-bg px-4 py-2 text-body-sm text-success-fg">
          <CheckCircle2 className="h-4 w-4" /> This prescription has been dispensed
          {record?.status === 'CANCELLED' ? ' and fully returned' : ''}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Section title={`Prescribed medications (${rx.items.length})`}>
          <div className="divide-y divide-line">
            {avail.lines.map((line) => {
              const p = plan[line.prescriptionItemId] ?? { inventoryItemId: '', quantity: 0 };
              const m = matchFor(line.prescriptionItemId, p.inventoryItemId);
              const short = m && m.available < p.quantity;
              return (
                <div key={line.prescriptionItemId} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-ink">{line.drugName}</div>
                    <Badge
                      tone={line.status === 'FOUND' ? 'success' : line.status === 'INSUFFICIENT' ? 'warning' : 'danger'}
                    >
                      {line.status}
                    </Badge>
                  </div>
                  <div className="text-label-sm text-ink-soft">Prescribed qty: {line.requestedQty}</div>

                  {line.matches.length === 0 ? (
                    <div className="mt-2 text-body-sm text-danger-fg">
                      No matching inventory item — stock this drug to dispense.
                    </div>
                  ) : (
                    !dispensed && (
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="flex-1">
                          <span className="mb-1 block text-label-sm text-ink-soft">
                            Stock item (FEFO batch auto-selected)
                          </span>
                          <Select
                            value={p.inventoryItemId}
                            onChange={(e) =>
                              setPlan((pl) => ({
                                ...pl,
                                [line.prescriptionItemId]: { ...p, inventoryItemId: e.target.value },
                              }))
                            }
                          >
                            {line.matches.map((mm) => (
                              <option key={mm.inventoryItemId} value={mm.inventoryItemId}>
                                {mm.name} — {mm.available} {mm.unit} avail
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="w-28">
                          <span className="mb-1 block text-label-sm text-ink-soft">Dispense qty</span>
                          <Input
                            inputMode="numeric"
                            className={cx('text-right', short && 'border-danger')}
                            value={String(p.quantity)}
                            onChange={(e) =>
                              setPlan((pl) => ({
                                ...pl,
                                [line.prescriptionItemId]: { ...p, quantity: Math.max(0, Number(e.target.value) || 0) },
                              }))
                            }
                          />
                        </label>
                      </div>
                    )
                  )}
                  {short && (
                    <div className="mt-1 text-label-sm text-danger-fg">Low stock — only {m?.available} available.</div>
                  )}
                  {m?.batches[0] && !dispensed && (
                    <div className="mt-1 text-label-sm text-ink-soft">
                      Next batch: {m.batches[0].batchNumber} · exp{' '}
                      {m.batches[0].expiryDate ? new Date(m.batches[0].expiryDate).toLocaleDateString() : '—'} ·{' '}
                      {money(m.batches[0].salePrice)}/unit
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Bill preview">
          <div className="space-y-3 px-5 py-4 text-body-sm">
            {dispensed ? (
              <p className="text-ink-soft">A pharmacy bill was generated at dispense time.{record?.billId ? '' : ''}</p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Estimated total</span>
                  <span className="text-title-lg text-ink">{money(billPreview)}</span>
                </div>
                <p className="text-label-sm text-ink-soft">
                  Final amount uses actual FEFO batch sale prices. A pharmacy bill is created on dispense.
                </p>
                {!canDispense && (
                  <p className="text-label-sm text-danger-fg">Resolve stock shortfalls before dispensing.</p>
                )}
              </>
            )}
          </div>
        </Section>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm dispense"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={dispense} loading={busy}>
              Dispense &amp; bill
            </Button>
          </>
        }
      >
        <p className="text-body-sm text-ink-muted">
          Stock will be deducted FEFO from the earliest-expiry batches and a pharmacy bill of about{' '}
          <span className="font-medium text-ink">{money(billPreview)}</span> will be created. This cannot be undone
          except via a return.
        </p>
      </Modal>

      <ReasonModal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Return dispensed items"
        description="Returns all dispensed items to stock and records a RETURN inventory transaction."
        confirmLabel="Process return"
        onConfirm={async (reason) => {
          if (!record) return;
          await pharmacyApi.returns(t, { dispenseRecordId: record.id, reason });
          toast.success('Return processed; stock restored.');
          await load();
        }}
      />
    </>
  );
}

export default function DispensePage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="PHARMACY" allowedRoles={['PHARMACIST', 'HOSPITAL_ADMIN']}>
      <Dispense id={params.id} />
    </Protected>
  );
}
