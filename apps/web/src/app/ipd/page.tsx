'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BedDouble, Plus, Settings2, UserPlus } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { ipdApi, WARD_TYPES, BED_STATUSES, type Occupancy, type Ward, type Bed, type AdmissionLite } from '@/lib/ipd';
import { formatDate } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  Select,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  StatCard,
  StatusChip,
  Badge,
  cx,
} from '@/components/ui';

const BED_TONE: Record<string, string> = {
  AVAILABLE: 'border-t-success',
  OCCUPIED: 'border-t-primary',
  MAINTENANCE: 'border-t-ink-soft',
  RESERVED: 'border-t-warning',
};

function IpdInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const perms = useMemo(
    () => new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []),
    [profile, activeTenantId],
  );

  const [occ, setOcc] = useState<Occupancy | null>(null);
  const [admissions, setAdmissions] = useState<AdmissionLite[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('ADMITTED');
  const [q, setQ] = useState('');
  const [manageOpen, setManageOpen] = useState(false);

  const loadOcc = useCallback(async () => {
    if (!t) return;
    try {
      setOcc(await ipdApi.occupancy(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  const loadAdmissions = useCallback(async () => {
    if (!t) return;
    try {
      setAdmissions(await ipdApi.listAdmissions(t, { status, q: q.trim() }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, status, q]);

  useEffect(() => {
    void loadOcc();
  }, [loadOcc]);
  useEffect(() => {
    void loadAdmissions();
  }, [loadAdmissions]);

  const canAdmit = perms.has('ipd.admit');
  const canManage = perms.has('ward.manage') || perms.has('bed.manage');

  return (
    <>
      <PageHeader
        title="Inpatient (IPD)"
        subtitle="Bed occupancy, admissions, and ward management"
        action={
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button variant="ghost" icon={Settings2} onClick={() => setManageOpen(true)}>
                Wards &amp; beds
              </Button>
            )}
            {canAdmit && (
              <Button icon={UserPlus} onClick={() => router.push('/ipd/admit')}>
                Admit patient
              </Button>
            )}
          </div>
        }
      />

      {err && <ErrorState message={err} />}
      {!occ && !err && <Spinner label="Loading wards…" />}

      {occ && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Occupied" value={occ.counts.occupied} />
            <StatCard label="Available" value={occ.counts.available} />
            <StatCard label="Maintenance" value={occ.counts.maintenance} />
            <StatCard label="Reserved" value={occ.counts.reserved} />
            <StatCard label="Discharges today" value={occ.counts.dischargesToday} />
          </div>

          {occ.wards.length === 0 ? (
            <Section title="Wards">
              <div className="px-5 py-8">
                <EmptyState
                  icon={BedDouble}
                  title="No active wards"
                  hint="Add a ward and beds to start admitting patients."
                  action={
                    canManage ? (
                      <Button size="sm" icon={Plus} onClick={() => setManageOpen(true)}>
                        Manage wards &amp; beds
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            </Section>
          ) : (
            <div className="mb-6 space-y-5">
              {occ.wards.map((w) => (
                <Section key={w.id} title={w.name} action={<Badge tone="slate">{w.type}</Badge>}>
                  {w.beds.length === 0 ? (
                    <p className="px-5 py-4 text-body-sm text-ink-soft">No beds in this ward.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                      {w.beds.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => b.admission && router.push(`/ipd/admissions/${b.admission.id}`)}
                          disabled={!b.admission}
                          className={cx(
                            'flex flex-col gap-1 rounded-xl border border-line border-t-4 bg-surface p-3 text-left transition-shadow',
                            BED_TONE[b.status],
                            b.admission ? 'cursor-pointer hover:shadow-md' : 'cursor-default opacity-90',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-canvas px-1.5 py-0.5 text-label-sm font-medium text-ink">
                              {b.bedNumber}
                            </span>
                            <BedDouble
                              className={cx('h-4 w-4', b.status === 'OCCUPIED' ? 'text-primary' : 'text-ink-soft')}
                            />
                          </div>
                          {b.admission ? (
                            <>
                              <span className="truncate text-body-sm font-medium text-ink">
                                {b.admission.patient?.fullName}
                              </span>
                              <span className="text-label-sm text-ink-soft">
                                Since {formatDate(b.admission.admittedAt)}
                              </span>
                            </>
                          ) : (
                            <span className="py-2 text-center text-label-sm capitalize text-ink-soft">
                              {b.status.toLowerCase()}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </Section>
              ))}
            </div>
          )}

          <Section
            title="Admissions"
            action={
              <div className="flex gap-2">
                <Input
                  className="w-44"
                  placeholder="Search patient…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="ADMITTED">Admitted</option>
                  <option value="DISCHARGED">Discharged</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>
            }
          >
            {!admissions ? (
              <Spinner label="Loading admissions…" />
            ) : admissions.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState icon={BedDouble} title="No admissions" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead>
                    <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                      <th className="px-5 py-3 font-medium">Patient</th>
                      <th className="px-5 py-3 font-medium">Bed / ward</th>
                      <th className="px-5 py-3 font-medium">Admitted</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {admissions.map((a) => (
                      <tr
                        key={a.id}
                        className="cursor-pointer hover:bg-canvas"
                        onClick={() => router.push(`/ipd/admissions/${a.id}`)}
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium text-ink">{a.patient?.fullName}</div>
                          <div className="text-label-sm text-ink-soft">{a.patient?.mrn}</div>
                        </td>
                        <td className="px-5 py-3 text-ink-muted">
                          {a.bed?.bedNumber} · {a.bed?.ward?.name}
                        </td>
                        <td className="px-5 py-3 text-ink-muted">{formatDate(a.admittedAt)}</td>
                        <td className="px-5 py-3">
                          <StatusChip status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      <ManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        canWard={perms.has('ward.manage')}
        canBed={perms.has('bed.manage')}
        onChanged={loadOcc}
      />
    </>
  );
}

function ManageModal({
  open,
  onClose,
  canWard,
  canBed,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  canWard: boolean;
  canBed: boolean;
  onChanged: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [selWard, setSelWard] = useState('');
  const [newWard, setNewWard] = useState({ name: '', type: 'GENERAL', rate: '' });
  const [newBed, setNewBed] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    const ws = await ipdApi.listWards(t);
    setWards(ws);
    setSelWard((cur) => cur || ws[0]?.id || '');
  }, [t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);
  useEffect(() => {
    if (open && selWard)
      ipdApi
        .listBeds(t, selWard)
        .then(setBeds)
        .catch(() => {});
  }, [open, selWard, t]);

  async function addWard() {
    if (!newWard.name.trim()) return;
    setBusy(true);
    try {
      await ipdApi.createWard(t, {
        name: newWard.name.trim(),
        type: newWard.type,
        dailyRate: Math.max(0, Math.round((Number(newWard.rate) || 0) * 100)),
      });
      setNewWard({ name: '', type: 'GENERAL', rate: '' });
      await load();
      await onChanged();
      toast.success('Ward added.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addBed() {
    if (!newBed.trim() || !selWard) return;
    setBusy(true);
    try {
      await ipdApi.createBed(t, { wardId: selWard, bedNumber: newBed.trim() });
      setNewBed('');
      setBeds(await ipdApi.listBeds(t, selWard));
      await onChanged();
      toast.success('Bed added.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function setBedStatus(id: string, st: string) {
    try {
      await ipdApi.updateBed(t, id, { status: st });
      setBeds((bs) => bs.map((b) => (b.id === id ? { ...b, status: st as Bed['status'] } : b)));
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Wards & beds" footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-5">
        {canWard && (
          <div>
            <span className="mb-1 block text-label-md uppercase text-ink-soft">Add ward</span>
            <div className="flex gap-2">
              <Input
                placeholder="Ward name"
                value={newWard.name}
                onChange={(e) => setNewWard((w) => ({ ...w, name: e.target.value }))}
              />
              <Select
                className="w-36"
                value={newWard.type}
                onChange={(e) => setNewWard((w) => ({ ...w, type: e.target.value }))}
              >
                {WARD_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
              <Input
                className="w-28"
                type="number"
                min={0}
                placeholder="₹/day"
                value={newWard.rate}
                onChange={(e) => setNewWard((w) => ({ ...w, rate: e.target.value }))}
              />
              <Button onClick={addWard} loading={busy} disabled={!newWard.name.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}

        <FormField label="Ward">
          <Select value={selWard} onChange={(e) => setSelWard(e.target.value)}>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </FormField>

        {selWard && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label-md uppercase text-ink-soft">Beds</span>
              {canBed && (
                <div className="flex gap-2">
                  <Input
                    className="w-28"
                    placeholder="Bed no."
                    value={newBed}
                    onChange={(e) => setNewBed(e.target.value)}
                  />
                  <Button size="sm" icon={Plus} onClick={addBed} loading={busy} disabled={!newBed.trim()}>
                    Add bed
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {beds.length === 0 ? (
                <p className="text-body-sm text-ink-soft">No beds yet.</p>
              ) : (
                beds.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-md border border-line px-3 py-1.5"
                  >
                    <span className="text-body-sm font-medium text-ink">{b.bedNumber}</span>
                    {canBed ? (
                      <Select
                        className="w-36"
                        value={b.status}
                        onChange={(e) => setBedStatus(b.id, e.target.value)}
                        disabled={b.status === 'OCCUPIED'}
                      >
                        {BED_STATUSES.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone="slate">{b.status}</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function IpdPage() {
  return (
    <Protected requireModule="IPD" allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}>
      <IpdInner />
    </Protected>
  );
}
