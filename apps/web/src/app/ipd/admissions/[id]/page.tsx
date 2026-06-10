'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  BedDouble,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  HeartPulse,
  NotebookPen,
  Pill,
  Plus,
  Printer,
  Repeat2,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { ipdApi, type AdmissionDetail, type Bed, type BedChargePreview, type Charge, type MedAdmin, type NursingNote, type Round, type Transfer, type Vitals } from '@/lib/ipd';
import { ageFromDob, formatDate, formatDateTime, money, toMinor } from '@/lib/format';
import {
  Badge,
  Button,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Section,
  Select,
  Spinner,
  StatusChip,
  Textarea,
  cx,
} from '@/components/ui';

type TabKey = 'overview' | 'rounds' | 'nursing' | 'medications' | 'lab' | 'charges' | 'transfers' | 'billing';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: ClipboardList },
  { key: 'rounds', label: 'Rounds', icon: Stethoscope },
  { key: 'nursing', label: 'Nursing', icon: HeartPulse },
  { key: 'medications', label: 'Medications', icon: Pill },
  { key: 'lab', label: 'Lab orders', icon: FlaskConical },
  { key: 'charges', label: 'Charges', icon: CreditCard },
  { key: 'transfers', label: 'Transfers', icon: Repeat2 },
  { key: 'billing', label: 'Billing', icon: FileText },
];

function AdmissionDetailPageInner({ id }: { id: string }) {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = useMemo(() => new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []), [profile, activeTenantId]);

  const [admission, setAdmission] = useState<AdmissionDetail | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [transferOpen, setTransferOpen] = useState(false);
  const [roundOpen, setRoundOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const [adm, occ] = await Promise.all([ipdApi.getAdmission(t, id), ipdApi.occupancy(t)]);
      setAdmission(adm);
      setBeds(occ.wards.flatMap((w) => w.beds.map((b) => ({ ...b, ward: { name: w.name } }))));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!admission) return <Spinner label="Loading admission..." />;

  const active = admission.status === 'ADMITTED';
  const availableBeds = beds.filter((b) => b.status === 'AVAILABLE' && b.id !== admission.bedId);
  const canTransfer = active && perms.has('ipd.transfer');
  const canRound = active && perms.has('ipd.round.write');
  const canCharge = active && perms.has('ipd.charge.write');
  const canDischarge = active && perms.has('ipd.discharge');
  const latestVitals = admission.vitals[0];
  const paid = totalPayments(admission);
  const balance = admission.bill ? admission.bill.netAmount - paid : 0;

  return (
    <>
      <Link href="/ipd" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to IPD
      </Link>

      <PageHeader
        title={admission.patient.fullName}
        subtitle={`${admission.patient.mrn} - ${admission.bed.ward.name} / ${admission.bed.bedNumber}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canTransfer && (
              <Button variant="ghost" icon={Repeat2} onClick={() => setTransferOpen(true)}>
                Transfer bed
              </Button>
            )}
            {canRound && (
              <Button variant="ghost" icon={Stethoscope} onClick={() => setRoundOpen(true)}>
                Add round
              </Button>
            )}
            {canCharge && (
              <Button variant="ghost" icon={CreditCard} onClick={() => setChargeOpen(true)}>
                Add charge
              </Button>
            )}
            <Link href={`/ipd/admissions/${admission.id}/summary`}>
              <Button variant="ghost" icon={Printer}>
                Print summary
              </Button>
            </Link>
            {canDischarge && (
              <Link href={`/ipd/admissions/${admission.id}/discharge`}>
                <Button icon={FileText}>Discharge</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Admission status" value={<StatusChip status={admission.status} />} hint={`Admitted ${formatDateTime(admission.admittedAt)}`} />
        <InfoCard label="Bed status" value={`${admission.bed.ward.name} / ${admission.bed.bedNumber}`} hint={admission.bed.ward.type} />
        <InfoCard label="Attending doctor" value={admission.providerName ?? 'Unassigned'} hint="Primary IPD provider" />
        <InfoCard label="Billing balance" value={admission.bill ? money(balance) : 'No bill'} hint={admission.bill?.billNumber ?? 'Charges create an IPD bill'} />
      </div>

      <div className="mb-5 overflow-x-auto border-b border-line">
        <div className="flex min-w-max gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cx(
                'flex items-center gap-2 border-b-2 px-3 py-3 text-body-sm font-medium',
                tab === key ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && <Overview admission={admission} latestVitals={latestVitals} />}
      {tab === 'rounds' && <Rounds rounds={admission.rounds} onAdd={canRound ? () => setRoundOpen(true) : undefined} />}
      {tab === 'nursing' && <Nursing admission={admission} />}
      {tab === 'medications' && <Medications meds={admission.medications} />}
      {tab === 'lab' && <LabOrders orders={admission.labOrders} />}
      {tab === 'charges' && (
        <div className="space-y-4">
          <BedChargeCard admission={admission} canCharge={canCharge} onPosted={load} />
          <Charges charges={admission.charges} currency="INR" onAdd={canCharge ? () => setChargeOpen(true) : undefined} />
        </div>
      )}
      {tab === 'transfers' && <Transfers transfers={admission.transfers} beds={beds} />}
      {tab === 'billing' && <Billing admission={admission} paid={paid} />}

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        beds={availableBeds}
        onSubmit={async (toBedId, reason) => {
          await ipdApi.transfer(t, id, toBedId, reason);
          toast.success('Bed transfer completed.');
          setTransferOpen(false);
          await load();
        }}
      />
      <RoundModal
        open={roundOpen}
        onClose={() => setRoundOpen(false)}
        onSubmit={async (notes) => {
          await ipdApi.addRound(t, id, notes);
          toast.success('Doctor round added.');
          setRoundOpen(false);
          await load();
        }}
      />
      <ChargeModal
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        onSubmit={async (body) => {
          await ipdApi.addCharge(t, id, body);
          toast.success('IPD charge added.');
          setChargeOpen(false);
          await load();
        }}
      />
    </>
  );
}

function Overview({ admission, latestVitals }: { admission: AdmissionDetail; latestVitals?: Vitals }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Section title="Patient summary" className="lg:col-span-1">
        <div className="space-y-3 p-5 text-body-sm">
          <Row label="Name" value={admission.patient.fullName} />
          <Row label="MRN" value={admission.patient.mrn} />
          <Row label="Age / sex" value={`${ageFromDob(admission.patient.dob)} / ${admission.patient.sex ?? '-'}`} />
          <Row label="Phone" value={admission.patient.phone ?? '-'} />
          <Row label="Expected discharge" value={formatDate(admission.expectedDischargeAt)} />
          <div>
            <div className="mb-1 text-label-sm uppercase text-ink-soft">Allergies</div>
            {admission.patient.allergies.length ? (
              <div className="flex flex-wrap gap-1.5">
                {admission.patient.allergies.map((a) => (
                  <Badge key={a.id} tone="danger">
                    {a.substance}{a.severity ? ` - ${a.severity}` : ''}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-ink-muted">No recorded allergies</span>
            )}
          </div>
        </div>
      </Section>

      <Section title="Clinical snapshot" className="lg:col-span-2">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <InfoCard label="Latest BP" value={latestVitals ? `${latestVitals.systolicBp ?? '-'} / ${latestVitals.diastolicBp ?? '-'}` : '-'} />
          <InfoCard label="Pulse / SpO2" value={latestVitals ? `${latestVitals.pulse ?? '-'} bpm / ${latestVitals.spo2 ?? '-'}%` : '-'} />
          <InfoCard label="Temperature" value={latestVitals?.temperature ? `${latestVitals.temperature} C` : '-'} />
          <InfoCard label="Respiratory rate" value={latestVitals?.respiratoryRate ?? '-'} />
        </div>
        <div className="border-t border-line p-5">
          <Timeline
            rows={[
              { label: 'Admission created', at: admission.admittedAt, body: `${admission.bed.ward.name} / ${admission.bed.bedNumber}` },
              ...admission.transfers.map((tr) => ({ label: 'Bed transfer', at: tr.transferredAt, body: tr.reason ?? 'No reason recorded' })),
              ...admission.rounds.map((r) => ({ label: 'Doctor round', at: r.createdAt, body: r.notes })),
              ...admission.charges.map((c) => ({ label: 'IPD charge', at: c.createdAt, body: c.description })),
              ...(admission.dischargedAt ? [{ label: 'Discharged', at: admission.dischargedAt, body: admission.dischargeReason ?? '' }] : []),
            ]}
          />
        </div>
      </Section>
    </div>
  );
}

function Rounds({ rounds, onAdd }: { rounds: Round[]; onAdd?: () => void }) {
  return (
    <Section title="Doctor rounds" action={onAdd ? <Button size="sm" icon={Plus} onClick={onAdd}>Add round</Button> : undefined}>
      {rounds.length === 0 ? (
        <EmptyInline text="No doctor rounds have been recorded for this admission." />
      ) : (
        <div className="divide-y divide-line">
          {rounds.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="mb-1 text-label-sm uppercase text-ink-soft">{formatDateTime(r.createdAt)}</div>
              <p className="whitespace-pre-wrap text-body-sm text-ink">{r.notes}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Nursing({ admission }: { admission: AdmissionDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Vitals">
        {admission.vitals.length === 0 ? (
          <EmptyInline text="No vitals recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">BP</th>
                  <th className="px-5 py-3 font-medium">Pulse</th>
                  <th className="px-5 py-3 font-medium">SpO2</th>
                  <th className="px-5 py-3 font-medium">Temp</th>
                  <th className="px-5 py-3 font-medium">RR</th>
                  <th className="px-5 py-3 font-medium">Weight / height</th>
                  <th className="px-5 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {admission.vitals.map((v) => (
                  <tr key={v.id}>
                    <td className="px-5 py-3 text-ink-muted">{formatDateTime(v.recordedAt)}</td>
                    <td className="px-5 py-3">{v.systolicBp ?? '-'} / {v.diastolicBp ?? '-'}</td>
                    <td className="px-5 py-3">{v.pulse ?? '-'}</td>
                    <td className="px-5 py-3">{v.spo2 ?? '-'}</td>
                    <td className="px-5 py-3">{v.temperature ?? '-'}</td>
                    <td className="px-5 py-3">{v.respiratoryRate ?? '-'}</td>
                    <td className="px-5 py-3">{v.weightKg ?? '-'} / {v.heightCm ?? '-'}</td>
                    <td className="px-5 py-3 text-ink-muted">{v.notes ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title="Nursing notes">
        <NoteList notes={admission.nursingNotes} />
      </Section>
    </div>
  );
}

function Medications({ meds }: { meds: MedAdmin[] }) {
  return (
    <Section title="Medication administration">
      {meds.length === 0 ? (
        <EmptyInline text="No medication administrations recorded." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Prescription item</th>
                <th className="px-5 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {meds.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-3 text-ink-muted">{formatDateTime(m.administeredAt)}</td>
                  <td className="px-5 py-3"><StatusChip status={m.status} /></td>
                  <td className="px-5 py-3 text-ink-muted">{m.prescriptionItemId ?? '-'}</td>
                  <td className="px-5 py-3 text-ink-muted">{m.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function LabOrders({ orders }: { orders: AdmissionDetail['labOrders'] }) {
  return (
    <Section title="Lab orders">
      {orders.length === 0 ? (
        <EmptyInline text="No lab orders linked to this admission." />
      ) : (
        <div className="divide-y divide-line">
          {orders.map((o) => (
            <Link key={o.id} href={`/lab/orders/${o.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-canvas">
              <div>
                <div className="font-medium text-ink">Order {o.id.slice(0, 8)}</div>
                <div className="text-label-sm text-ink-soft">{formatDateTime(o.createdAt)}</div>
              </div>
              <StatusChip status={o.status} />
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

function BedChargeCard({ admission, canCharge, onPosted }: { admission: AdmissionDetail; canCharge: boolean; onPosted: () => Promise<void> }) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [preview, setPreview] = useState<BedChargePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      setPreview(await ipdApi.bedChargePreview(activeTenantId, admission.id));
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, admission.id]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const pending = preview?.pending.lines.filter((l) => l.total > 0) ?? [];
  const pendingTotal = pending.reduce((s, l) => s + l.total, 0);
  const rate = preview?.currentWard?.dailyRate ?? 0;
  const hasRate = !!preview?.currentWard && rate > 0;
  const active = admission.status === 'ADMITTED';

  async function post() {
    if (!activeTenantId) return;
    setBusy(true);
    try {
      const res = await ipdApi.accrueBedCharges(activeTenantId, admission.id);
      toast.success(res.posted ? `Posted ${res.plan.totalUnits} bed-day(s) to the bill.` : 'No completed days to bill yet.');
      await onPosted();
      await loadPreview();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Room / bed charges (per-diem)"
      action={
        canCharge && pendingTotal > 0 ? (
          <Button size="sm" icon={CreditCard} onClick={post} loading={busy}>
            Post bed charges
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-body-sm text-ink-muted">Calculating room charges…</p>
      ) : !hasRate ? (
        <p className="text-body-sm text-ink-muted">
          No room rate is configured for {preview?.currentWard?.name ?? 'this ward'}. Set a daily rate in{' '}
          <Link href="/admin/wards" className="font-medium text-primary hover:underline">
            Admin → Wards
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body-sm">
            <span className="text-ink-muted">
              Room: <span className="font-medium text-ink">{preview!.currentWard!.name}</span> · {money(rate)}/day
            </span>
            <span className="text-ink-muted">
              Billable now: <span className="font-medium text-ink">{money(pendingTotal)}</span>
            </span>
            {active && (
              <span className="text-ink-muted">
                If discharged now: <span className="font-medium text-ink">{money(preview!.projected.totalAmount)}</span> ({preview!.projected.totalUnits} day
                {preview!.projected.totalUnits === 1 ? '' : 's'})
              </span>
            )}
          </div>
          {pending.length > 0 ? (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="py-1">Ward</th>
                  <th>Days</th>
                  <th>Rate / day</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((l) => (
                  <tr key={l.wardId + l.fromDate} className="border-t border-line">
                    <td className="py-1.5">
                      {l.wardName} <span className="ml-1 text-ink-soft">{l.fromDate}…{l.toDate}</span>
                    </td>
                    <td>{l.units}</td>
                    <td>{money(l.unitPrice)}</td>
                    <td className="text-right font-medium">{money(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line font-semibold">
                  <td className="py-1.5" colSpan={3}>
                    Billable now
                  </td>
                  <td className="text-right">{money(pendingTotal)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">
              {active
                ? 'Today is still in progress — completed days post to an interim bill here, and the current day is billed automatically at discharge.'
                : 'Bed charges were finalized at discharge and appear on the bill.'}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

function Charges({ charges, currency, onAdd }: { charges: Charge[]; currency: string; onAdd?: () => void }) {
  const total = charges.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
  return (
    <Section title="IPD charges" action={onAdd ? <Button size="sm" icon={Plus} onClick={onAdd}>Add charge</Button> : <Badge>{money(total, currency)}</Badge>}>
      {charges.length === 0 ? (
        <EmptyInline text="No IPD charges have been posted." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium">Qty</th>
                <th className="px-5 py-3 text-right font-medium">Unit</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{c.description}</div>
                    <div className="text-label-sm text-ink-soft">{c.notes ?? formatDateTime(c.createdAt)}</div>
                  </td>
                  <td className="px-5 py-3 text-right">{c.quantity}</td>
                  <td className="px-5 py-3 text-right text-ink-muted">{money(c.unitPrice, currency)}</td>
                  <td className="px-5 py-3 text-right font-medium">{money(c.quantity * c.unitPrice, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Transfers({ transfers, beds }: { transfers: Transfer[]; beds: Bed[] }) {
  const nameFor = (idv: string) => {
    const bed = beds.find((b) => b.id === idv);
    return bed ? `${bed.ward?.name ?? 'Ward'} / ${bed.bedNumber}` : idv.slice(0, 8);
  };
  return (
    <Section title="Bed transfers">
      {transfers.length === 0 ? (
        <EmptyInline text="No transfers for this admission." />
      ) : (
        <div className="divide-y divide-line">
          {transfers.map((tr) => (
            <div key={tr.id} className="px-5 py-4 text-body-sm">
              <div className="font-medium text-ink">{nameFor(tr.fromBedId)} &rarr; {nameFor(tr.toBedId)}</div>
              <div className="mt-1 text-ink-muted">{formatDateTime(tr.transferredAt)} - {tr.reason ?? 'No reason recorded'}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Billing({ admission, paid }: { admission: AdmissionDetail; paid: number }) {
  const bill = admission.bill;
  if (!bill) {
    return (
      <Section title="Billing">
        <EmptyInline text="No IPD bill exists yet. Adding an IPD charge will create or append to the bill." />
      </Section>
    );
  }
  const balance = bill.netAmount - paid;
  return (
    <Section
      title="Billing"
      action={
        <Link href={`/billing/${bill.id}`}>
          <Button size="sm" variant="ghost" icon={FileText}>Open bill</Button>
        </Link>
      }
    >
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Bill number" value={bill.billNumber} />
        <InfoCard label="Status" value={<StatusChip status={bill.status} />} />
        <InfoCard label="Net total" value={money(bill.netAmount)} />
        <InfoCard label="Balance" value={money(balance)} />
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 text-right font-medium">Qty</th>
              <th className="px-5 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bill.items.map((it) => (
              <tr key={it.id}>
                <td className="px-5 py-3 text-ink">{it.name}</td>
                <td className="px-5 py-3 text-right text-ink-muted">{it.quantity}</td>
                <td className="px-5 py-3 text-right font-medium">{money(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function TransferModal({ open, onClose, beds, onSubmit }: { open: boolean; onClose: () => void; beds: Bed[]; onSubmit: (toBedId: string, reason: string) => Promise<void> }) {
  const [toBedId, setToBedId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setToBedId('');
      setReason('');
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    if (!toBedId || !reason.trim()) {
      setErr('Select an available bed and enter the transfer reason.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(toBedId, reason.trim());
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
      title="Transfer bed"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button icon={Repeat2} onClick={submit} loading={busy} disabled={!toBedId || !reason.trim()}>Transfer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Available bed" required>
          <Select value={toBedId} onChange={(e) => setToBedId(e.target.value)}>
            <option value="">Select bed...</option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>{b.ward?.name ?? 'Ward'} / {b.bedNumber}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Transfer reason" required error={err}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Clinical, operational, or patient-care reason" />
        </FormField>
      </div>
    </Modal>
  );
}

function RoundModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNotes('');
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    if (!notes.trim()) {
      setErr('Round notes are required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(notes.trim());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add doctor round" footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button icon={NotebookPen} onClick={submit} loading={busy} disabled={!notes.trim()}>Save round</Button></>}>
      <FormField label="Round notes" required error={err}>
        <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assessment, plan, orders, and follow-up" autoFocus />
      </FormField>
    </Modal>
  );
}

function ChargeModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (body: { description: string; quantity?: number; unitPrice: number; notes?: string }) => Promise<void> }) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setQuantity('1');
      setUnitPrice('');
      setNotes('');
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    const price = toMinor(unitPrice);
    const qty = Number(quantity);
    if (!description.trim() || !price || qty < 1) {
      setErr('Description, quantity, and unit price are required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ description: description.trim(), quantity: qty, unitPrice: price, notes: notes.trim() || undefined });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add IPD charge" footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button icon={CreditCard} onClick={submit} loading={busy} disabled={!description.trim() || !unitPrice}>Add charge</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Description" required>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Room charge, procedure, equipment..." autoFocus />
          </FormField>
        </div>
        <FormField label="Quantity" required>
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </FormField>
        <FormField label="Unit price" required error={err}>
          <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional billing note" />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

function InfoCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-label-sm uppercase text-ink-soft">{label}</div>
      <div className="mt-1 min-h-6 text-title-lg text-ink">{value}</div>
      {hint && <div className="mt-1 text-body-sm text-ink-muted">{hint}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <p className="px-5 py-8 text-center text-body-sm text-ink-soft">{text}</p>;
}

function NoteList({ notes }: { notes: NursingNote[] }) {
  if (notes.length === 0) return <EmptyInline text="No nursing notes recorded yet." />;
  return (
    <div className="divide-y divide-line">
      {notes.map((n) => (
        <div key={n.id} className="px-5 py-4">
          <div className="mb-1 text-label-sm uppercase text-ink-soft">{formatDateTime(n.createdAt)}</div>
          <p className="whitespace-pre-wrap text-body-sm text-ink">{n.note}</p>
        </div>
      ))}
    </div>
  );
}

function Timeline({ rows }: { rows: { label: string; at: string | null; body: string }[] }) {
  const sorted = [...rows].filter((r) => r.at).sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime());
  if (sorted.length === 0) return <EmptyInline text="No timeline activity yet." />;
  return (
    <div className="space-y-3">
      {sorted.slice(0, 10).map((r, i) => (
        <div key={`${r.label}-${r.at}-${i}`} className="flex gap-3">
          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
          <div>
            <div className="text-body-sm font-medium text-ink">{r.label}</div>
            <div className="text-label-sm text-ink-soft">{formatDateTime(r.at)} - {r.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function totalPayments(admission: AdmissionDetail): number {
  return admission.bill?.payments?.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0) ?? 0;
}

export default function AdmissionPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="IPD" allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']} requirePermission={['ipd.read']}>
      <AdmissionDetailPageInner id={params.id} />
    </Protected>
  );
}
