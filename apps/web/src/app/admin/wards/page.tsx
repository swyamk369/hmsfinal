'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, BedDouble, Pencil } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { adminApi, type Ward, type Bed, WARD_TYPES, BED_STATUSES } from '@/lib/admin';
import { money } from '@/lib/format';
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
  StatusChip,
  cx,
} from '@/components/ui';

const BED_TONE: Record<string, string> = {
  AVAILABLE: 'border-success/40 bg-success-bg text-success-fg',
  OCCUPIED: 'border-danger/40 bg-danger-bg text-danger-fg',
  MAINTENANCE: 'border-line bg-slate-100 text-slate-600',
  RESERVED: 'border-warning/40 bg-warning-bg text-warning-fg',
};

function WardsInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [wards, setWards] = useState<Ward[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wardModal, setWardModal] = useState<{ open: boolean; ward: Ward | null }>({ open: false, ward: null });
  const [bedModal, setBedModal] = useState<{ open: boolean; wardId: string; bed: Bed | null }>({
    open: false,
    wardId: '',
    bed: null,
  });

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      setWards(await adminApi.listWards(activeTenantId));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new'))
      setWardModal({ open: true, ward: null });
  }, []);

  return (
    <>
      <PageHeader
        title="Wards & Beds"
        subtitle="Inpatient wards and bed configuration"
        action={
          <Button icon={Plus} onClick={() => setWardModal({ open: true, ward: null })}>
            New ward
          </Button>
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!wards && !err && <Spinner label="Loading wards…" />}

      {wards && wards.length === 0 && (
        <EmptyState
          icon={BedDouble}
          title="No wards yet"
          hint="Create a ward, then add beds to it for inpatient admissions."
          action={
            <Button icon={Plus} onClick={() => setWardModal({ open: true, ward: null })}>
              New ward
            </Button>
          }
        />
      )}

      {wards && wards.length > 0 && (
        <div className="space-y-5">
          {wards.map((w) => (
            <Section
              key={w.id}
              title={w.name}
              action={
                <div className="flex items-center gap-2">
                  <span className={w.dailyRate > 0 ? 'text-body-sm font-medium text-ink-muted' : 'text-body-sm text-ink-soft'}>
                    {w.dailyRate > 0 ? `${money(w.dailyRate)}/day` : 'No rate set'}
                  </span>
                  <StatusChip status={w.type} />
                  {!w.active && <StatusChip status="INACTIVE" />}
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setWardModal({ open: true, ward: w })}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Plus}
                    onClick={() => setBedModal({ open: true, wardId: w.id, bed: null })}
                  >
                    Bed
                  </Button>
                </div>
              }
            >
              <div className="p-5">
                {w.beds.length === 0 ? (
                  <p className="text-body-sm text-ink-soft">No beds in this ward yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                    {w.beds.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setBedModal({ open: true, wardId: w.id, bed: b })}
                        className={cx(
                          'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition hover:brightness-95',
                          BED_TONE[b.status] ?? 'border-line bg-surface',
                        )}
                        title={`Bed ${b.bedNumber} — ${b.status}`}
                      >
                        <BedDouble className="h-4 w-4" />
                        <span className="text-body-sm font-semibold">{b.bedNumber}</span>
                        <span className="text-[10px] uppercase tracking-wide">{b.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          ))}
        </div>
      )}

      <WardModal
        open={wardModal.open}
        ward={wardModal.ward}
        onClose={() => setWardModal({ open: false, ward: null })}
        onSaved={load}
      />
      <BedModal
        open={bedModal.open}
        wardId={bedModal.wardId}
        bed={bedModal.bed}
        onClose={() => setBedModal({ open: false, wardId: '', bed: null })}
        onSaved={load}
      />
    </>
  );
}

function WardModal({
  open,
  ward,
  onClose,
  onSaved,
}: {
  open: boolean;
  ward: Ward | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('GENERAL');
  const [active, setActive] = useState(true);
  const [dailyRate, setDailyRate] = useState(0); // rupees in the form; stored as paise
  const [busy, setBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(ward?.name ?? '');
      setType(ward?.type ?? 'GENERAL');
      setActive(ward?.active ?? true);
      setDailyRate(ward ? (ward.dailyRate ?? 0) / 100 : 0);
      setNameErr(null);
    }
  }, [open, ward]);

  async function submit() {
    if (!activeTenantId) return;
    if (!name.trim()) {
      setNameErr('Name is required.');
      return;
    }
    setBusy(true);
    try {
      const rate = Math.max(0, Math.round((Number(dailyRate) || 0) * 100));
      if (ward) await adminApi.updateWard(activeTenantId, ward.id, { name: name.trim(), type, active, dailyRate: rate });
      else await adminApi.createWard(activeTenantId, { name: name.trim(), type, dailyRate: rate });
      toast.success(ward ? 'Ward updated.' : 'Ward created.');
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
      title={ward ? 'Edit ward' : 'New ward'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            {ward ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Ward name" required error={nameErr}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="General Ward A" autoFocus />
        </FormField>
        <FormField label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {WARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Daily room rate (₹)" hint="Charged per calendar day of stay. 0 = not auto-charged.">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={dailyRate}
            onChange={(e) => setDailyRate(Number(e.target.value))}
            placeholder="0"
          />
        </FormField>
        {ward && (
          <FormField label="Status">
            <Select value={active ? 'true' : 'false'} onChange={(e) => setActive(e.target.value === 'true')}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FormField>
        )}
      </div>
    </Modal>
  );
}

function BedModal({
  open,
  wardId,
  bed,
  onClose,
  onSaved,
}: {
  open: boolean;
  wardId: string;
  bed: Bed | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [bedNumber, setBedNumber] = useState('');
  const [status, setStatus] = useState<string>('AVAILABLE');
  const [busy, setBusy] = useState(false);
  const [numErr, setNumErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBedNumber(bed?.bedNumber ?? '');
      setStatus(bed?.status ?? 'AVAILABLE');
      setNumErr(null);
    }
  }, [open, bed]);

  async function submit() {
    if (!activeTenantId) return;
    if (!bedNumber.trim()) {
      setNumErr('Bed number is required.');
      return;
    }
    setBusy(true);
    try {
      if (bed) await adminApi.updateBed(activeTenantId, bed.id, { bedNumber: bedNumber.trim(), status });
      else await adminApi.createBed(activeTenantId, { wardId, bedNumber: bedNumber.trim(), status });
      toast.success(bed ? 'Bed updated.' : 'Bed added.');
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
      title={bed ? `Edit bed ${bed.bedNumber}` : 'Add bed'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!bedNumber.trim()}>
            {bed ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Bed number" required error={numErr}>
          <Input value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} placeholder="A-01" autoFocus />
        </FormField>
        <FormField label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {BED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  );
}

export default function WardsPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']} requireModule="IPD">
      <WardsInner />
    </Protected>
  );
}
