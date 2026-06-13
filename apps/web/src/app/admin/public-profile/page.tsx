'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Eye, EyeOff, Plus, ExternalLink, Stethoscope, Clock, X, UserCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import {
  publicAdminApi,
  listToText,
  textToList,
  type PortalSettings,
  type HospitalProfile,
  type AppointmentType,
  type DoctorProfileRow,
  type AvailabilityRule,
  type AccessRequest,
} from '@/lib/public-admin';
import { opdApi, type DoctorRef } from '@/lib/opd';
import { money } from '@/lib/format';
import {
  Button,
  PageHeader,
  Section,
  FormField,
  Input,
  Select,
  Textarea,
  Spinner,
  ErrorState,
  StatusChip,
  Modal,
  ReasonModal,
  cx,
  Badge,
} from '@/components/ui';

type SubTab = 'profile' | 'settings' | 'types' | 'doctors' | 'access';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Inner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [tab, setTab] = useState<SubTab>('profile');
  return (
    <>
      <PageHeader
        title="Public Site & Patient Portal"
        subtitle="What patients see when they search, book, and use the portal"
      />
      <AdminTabs />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {(
          [
            ['profile', 'Hospital Profile'],
            ['settings', 'Portal & Booking'],
            ['types', 'Appointment Types'],
            ['doctors', 'Doctors'],
            ['access', 'Portal Access'],
          ] as [SubTab, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cx(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-body-sm font-medium',
              tab === k ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab t={t} />}
      {tab === 'settings' && <SettingsTab t={t} />}
      {tab === 'types' && <TypesTab t={t} />}
      {tab === 'doctors' && <DoctorsTab t={t} />}
      {tab === 'access' && <AccessTab t={t} />}
    </>
  );
}

// ── Hospital profile ──────────────────────────────────────────
function ProfileTab({ t }: { t: string }) {
  const toast = useToast();
  const [p, setP] = useState<HospitalProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    try {
      const prof = await publicAdminApi.getProfile(t);
      setP(prof);
      setF(
        prof
          ? {
              ...prof,
              specialties: listToText(prof.specialties),
              services: listToText(prof.services),
              facilities: listToText(prof.facilities),
            }
          : { hospitalDisplayName: '' },
      );
    } catch (e) {
      const message = (e as Error).message;
      setErr(
        message.includes('expected pattern')
          ? 'Could not load the hospital public profile because the web app API URL is invalid. Check NEXT_PUBLIC_API_URL in Render and redeploy the web service.'
          : message,
      );
    } finally {
      setLoaded(true);
    }
  }, [t]);
  useEffect(() => void load(), [load]);

  async function save() {
    setBusy(true);
    try {
      await publicAdminApi.saveProfile(t, {
        ...f,
        specialties: textToList(f.specialties ?? ''),
        services: textToList(f.services ?? ''),
        facilities: textToList(f.facilities ?? ''),
      });
      toast.success('Profile saved.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(label: string, fn: () => Promise<unknown>) {
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

  if (!loaded) return <Spinner label="Loading…" />;
  if (err) return <ErrorState message={err} />;
  const published = p?.profileStatus === 'PUBLISHED' && p?.isPublic;

  return (
    <Section
      title="Hospital public profile"
      action={
        <div className="flex items-center gap-2">
          {p && <StatusChip status={p.profileStatus} />}
          {p && published && (
            <Link
              href={`/hospitals/${p.hospitalSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-body-sm font-medium text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </Link>
          )}
          {p &&
            (published ? (
              <Button size="sm" variant="ghost" icon={EyeOff} loading={busy} onClick={() => setHide(true)}>
                Hide
              </Button>
            ) : (
              <Button
                size="sm"
                icon={Eye}
                loading={busy}
                onClick={() => act('Published — your hospital is now public.', () => publicAdminApi.publishProfile(t))}
              >
                Publish
              </Button>
            ))}
        </div>
      }
    >
      <div className="space-y-4 p-5">
        {!published && (
          <div className="rounded-md border border-warning/30 bg-warning-bg px-4 py-2 text-body-sm text-warning-fg">
            Your hospital is not visible in public search until you Publish.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Display name" required>
            <Input
              value={f.hospitalDisplayName ?? ''}
              onChange={(e) => setF({ ...f, hospitalDisplayName: e.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <Input value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </FormField>
          <FormField label="City">
            <Input value={f.city ?? ''} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </FormField>
          <FormField label="State">
            <Input value={f.state ?? ''} onChange={(e) => setF({ ...f, state: e.target.value })} />
          </FormField>
          <FormField label="Public email">
            <Input value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </FormField>
          <FormField label="Website">
            <Input value={f.website ?? ''} onChange={(e) => setF({ ...f, website: e.target.value })} />
          </FormField>
        </div>
        <FormField label="About">
          <Textarea
            rows={3}
            value={f.description ?? ''}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </FormField>
        <FormField label="Specialties" hint="Comma-separated">
          <Input
            value={f.specialties ?? ''}
            onChange={(e) => setF({ ...f, specialties: e.target.value })}
            placeholder="Cardiology, Pediatrics"
          />
        </FormField>
        <FormField label="Services" hint="Comma-separated">
          <Input
            value={f.services ?? ''}
            onChange={(e) => setF({ ...f, services: e.target.value })}
            placeholder="Consultation, Lab, Pharmacy"
          />
        </FormField>
        <FormField label="Facilities" hint="Comma-separated">
          <Input
            value={f.facilities ?? ''}
            onChange={(e) => setF({ ...f, facilities: e.target.value })}
            placeholder="Parking, Pharmacy"
          />
        </FormField>
        <Button icon={Globe} loading={busy} disabled={!f.hospitalDisplayName?.trim()} onClick={save}>
          Save profile
        </Button>
      </div>
      <ReasonModal
        open={hide}
        title="Hide from public"
        description="Your hospital and its doctors will be removed from public search."
        confirmLabel="Hide"
        onClose={() => setHide(false)}
        onConfirm={async (r) => {
          setHide(false);
          await act('Hidden from public.', () => publicAdminApi.hideProfile(t, r));
        }}
      />
    </Section>
  );
}

// ── Portal & booking settings ─────────────────────────────────
function SettingsTab({ t }: { t: string }) {
  const toast = useToast();
  const [s, setS] = useState<PortalSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    publicAdminApi
      .getSettings(t)
      .then(setS)
      .catch((e) => toast.error((e as Error).message));
  }, [t, toast]);
  if (!s) return <Spinner label="Loading…" />;
  const set = (patch: Partial<PortalSettings>) => setS({ ...s, ...patch });
  async function save() {
    setBusy(true);
    try {
      await publicAdminApi.saveSettings(t, s!);
      toast.success('Settings saved.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Patient portal & online booking">
      <div className="space-y-4 p-5">
        <Toggle
          label="Patient portal enabled"
          hint="Patients can log in to view their records"
          v={s.enabled}
          on={(v) => set({ enabled: v })}
        />
        <Toggle
          label="Online booking enabled"
          hint="Patients can book appointments from the public site"
          v={s.onlineBookingEnabled}
          on={(v) => set({ onlineBookingEnabled: v })}
        />
        <Toggle
          label="Allow new-patient bookings"
          v={s.allowNewPatientBookings}
          on={(v) => set({ allowNewPatientBookings: v })}
        />
        <Toggle
          label="Allow existing-patient bookings"
          v={s.allowExistingPatientBookings}
          on={(v) => set({ allowExistingPatientBookings: v })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Approval mode">
            <Select value={s.bookingApprovalMode} onChange={(e) => set({ bookingApprovalMode: e.target.value as any })}>
              <option value="AUTOMATIC">Automatic (instant confirm)</option>
              <option value="MANUAL">Manual (staff approve)</option>
              <option value="HYBRID">Hybrid</option>
            </Select>
          </FormField>
          <FormField label="Min. notice (hours)">
            <Input
              type="number"
              min={0}
              value={s.minimumBookingNoticeHours}
              onChange={(e) => set({ minimumBookingNoticeHours: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="Max. advance (days)">
            <Input
              type="number"
              min={1}
              value={s.maximumBookingAdvanceDays}
              onChange={(e) => set({ maximumBookingAdvanceDays: Number(e.target.value) })}
            />
          </FormField>
        </div>
        <FormField label="Timezone" hint="Booking slot times are shown and stored in this timezone">
          <Select value={s.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
            <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
            <option value="UTC">UTC</option>
          </Select>
        </FormField>
        <FormField label="Booking terms">
          <Textarea rows={2} value={s.bookingTerms ?? ''} onChange={(e) => set({ bookingTerms: e.target.value })} />
        </FormField>
        <FormField label="Cancellation policy">
          <Textarea
            rows={2}
            value={s.cancellationPolicy ?? ''}
            onChange={(e) => set({ cancellationPolicy: e.target.value })}
          />
        </FormField>
        <Button loading={busy} onClick={save}>
          Save settings
        </Button>
      </div>
    </Section>
  );
}
function Toggle({ label, hint, v, on }: { label: string; hint?: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <button
      onClick={() => on(!v)}
      className="flex w-full items-center justify-between rounded-lg border border-line p-3 text-left"
    >
      <span>
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="block text-label-sm text-ink-soft">{hint}</span>}
      </span>
      <span className={cx('relative h-6 w-11 rounded-full transition', v ? 'bg-primary' : 'bg-slate-300')}>
        <span
          className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white transition', v ? 'left-[22px]' : 'left-0.5')}
        />
      </span>
    </button>
  );
}

// ── Appointment types ─────────────────────────────────────────
function TypesTab({ t }: { t: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<AppointmentType[] | null>(null);
  const [edit, setEdit] = useState<AppointmentType | 'new' | null>(null);
  const load = useCallback(() => {
    publicAdminApi
      .listTypes(t)
      .then(setRows)
      .catch((e) => toast.error((e as Error).message));
  }, [t, toast]);
  useEffect(() => load(), [load]);
  if (!rows) return <Spinner label="Loading…" />;
  return (
    <Section
      title="Appointment types"
      action={
        <Button size="sm" icon={Plus} onClick={() => setEdit('new')}>
          Add type
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Duration</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-soft">
                  No appointment types yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas">
                <td className="px-5 py-3 font-medium text-ink">
                  {r.name}
                  {r.requiresApproval && <Badge tone="amber">Needs approval</Badge>}
                </td>
                <td className="px-5 py-3 text-ink-muted">{r.durationMinutes} min</td>
                <td className="px-5 py-3 text-ink-muted">{money(r.price)}</td>
                <td className="px-5 py-3 text-ink-muted">{r.consultationType}</td>
                <td className="px-5 py-3">
                  {r.isActive ? <StatusChip status="ACTIVE" /> : <StatusChip status="INACTIVE" />}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <TypeModal
          t={t}
          row={edit === 'new' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </Section>
  );
}
function TypeModal({
  t,
  row,
  onClose,
  onSaved,
}: {
  t: string;
  row: AppointmentType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({
    name: row?.name ?? '',
    description: row?.description ?? '',
    durationMinutes: row?.durationMinutes ?? 15,
    price: (row?.price ?? 0) / 100,
    consultationType: row?.consultationType ?? 'IN_PERSON',
    requiresApproval: row?.requiresApproval ?? false,
    isPublic: row?.isPublic ?? true,
    isActive: row?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const body = { ...f, price: Math.round((Number(f.price) || 0) * 100) };
      if (row) await publicAdminApi.updateType(t, row.id, body);
      else await publicAdminApi.createType(t, body);
      toast.success('Saved.');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={row ? 'Edit appointment type' : 'New appointment type'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!f.name.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Name" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </FormField>
        <FormField label="Description">
          <Input value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Duration (min)">
            <Input
              type="number"
              min={1}
              value={f.durationMinutes}
              onChange={(e) => setF({ ...f, durationMinutes: Number(e.target.value) })}
            />
          </FormField>
          <FormField label="Price (₹)">
            <Input
              type="number"
              min={0}
              value={f.price}
              onChange={(e) => setF({ ...f, price: Number(e.target.value) })}
            />
          </FormField>
        </div>
        <FormField label="Consultation type">
          <Select value={f.consultationType} onChange={(e) => setF({ ...f, consultationType: e.target.value as any })}>
            <option value="IN_PERSON">In-person</option>
            <option value="TELEHEALTH">Telehealth</option>
            <option value="BOTH">Both</option>
          </Select>
        </FormField>
        <label className="flex items-center gap-2 text-body-sm">
          <input
            type="checkbox"
            checked={f.requiresApproval}
            onChange={(e) => setF({ ...f, requiresApproval: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />{' '}
          Requires staff approval
        </label>
        <label className="flex items-center gap-2 text-body-sm">
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => setF({ ...f, isActive: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />{' '}
          Active
        </label>
      </div>
    </Modal>
  );
}

// ── Doctor public profiles ────────────────────────────────────
function DoctorsTab({ t }: { t: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<DoctorProfileRow[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [adding, setAdding] = useState(false);
  const [hideId, setHideId] = useState<string | null>(null);
  const [hours, setHours] = useState<DoctorProfileRow | null>(null);
  const load = useCallback(() => {
    publicAdminApi
      .listDoctorProfiles(t)
      .then(setRows)
      .catch((e) => toast.error((e as Error).message));
    opdApi
      .doctors(t)
      .then(setDoctors)
      .catch(() => {});
  }, [t, toast]);
  useEffect(() => load(), [load]);
  async function act(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      toast.success(label);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (!rows) return <Spinner label="Loading…" />;
  const profiledIds = new Set(rows.map((r) => r.doctorId));
  const unprofiled = doctors.filter((d) => !profiledIds.has(d.id));
  return (
    <Section
      title="Doctor public profiles"
      action={
        unprofiled.length > 0 && (
          <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
            Add doctor
          </Button>
        )
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3">Doctor</th>
              <th className="px-5 py-3">Specialty</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink-soft">
                  No doctor profiles yet. Add one to list a doctor publicly.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const live = r.profileStatus === 'PUBLISHED' && r.isPublic;
              return (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className="px-5 py-3 font-medium text-ink">
                    <span className="inline-flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-ink-muted" />
                      {r.displayName}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{r.specialty ?? '—'}</td>
                  <td className="px-5 py-3">
                    <StatusChip status={r.profileStatus} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" icon={Clock} onClick={() => setHours(r)}>
                        Hours
                      </Button>
                      {live ? (
                        <Button size="sm" variant="ghost" icon={EyeOff} onClick={() => setHideId(r.id)}>
                          Hide
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          icon={Eye}
                          onClick={() => act('Doctor published.', () => publicAdminApi.publishDoctorProfile(t, r.id))}
                        >
                          Publish
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {adding && (
        <AddDoctorModal
          t={t}
          doctors={unprofiled}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
      {hours && <AvailabilityModal t={t} doctor={hours} onClose={() => setHours(null)} />}
      <ReasonModal
        open={!!hideId}
        title="Hide doctor"
        description="This doctor will be removed from public search and booking."
        confirmLabel="Hide"
        onClose={() => setHideId(null)}
        onConfirm={async (r) => {
          const id = hideId!;
          setHideId(null);
          await act('Doctor hidden.', () => publicAdminApi.hideDoctorProfile(t, id, r));
        }}
      />
    </Section>
  );
}
function AddDoctorModal({
  t,
  doctors,
  onClose,
  onSaved,
}: {
  t: string;
  doctors: DoctorRef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '');
  const [specialty, setSpecialty] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = doctors.find((d) => d.id === doctorId);
  async function save() {
    if (!doctorId) return;
    setBusy(true);
    try {
      await publicAdminApi.createDoctorProfile(t, {
        doctorId,
        displayName: selected?.fullName ?? 'Doctor',
        specialty: specialty.trim() || selected?.speciality || undefined,
        consultationTypes: ['IN_PERSON', 'TELEHEALTH'],
        acceptsNewPatients: true,
        telehealthAvailable: true,
      });
      toast.success('Doctor profile created. Publish it to go live.');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Add doctor public profile"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!doctorId} onClick={save}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Doctor">
          <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Specialty">
          <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiologist" />
        </FormField>
      </div>
    </Modal>
  );
}

// ── Per-doctor availability ───────────────────────────────────
type DayRule = { id?: string; enabled: boolean; startTime: string; endTime: string; slotDurationMinutes: number };
function AvailabilityModal({ t, doctor, onClose }: { t: string; doctor: DoctorProfileRow; onClose: () => void }) {
  const toast = useToast();
  const [rules, setRules] = useState<DayRule[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    publicAdminApi
      .listAvailability(t, doctor.doctorId)
      .then((rows) => {
        const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
        setRules(
          DAYS.map((_, d) => {
            const r = byDay.get(d);
            return r
              ? {
                  id: r.id,
                  enabled: r.isActive,
                  startTime: r.startTime,
                  endTime: r.endTime,
                  slotDurationMinutes: r.slotDurationMinutes,
                }
              : { enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 15 };
          }),
        );
      })
      .catch((e) => toast.error((e as Error).message));
  }, [t, doctor.doctorId, toast]);
  useEffect(() => load(), [load]);

  function setDay(d: number, patch: Partial<DayRule>) {
    setRules((rs) => rs!.map((r, i) => (i === d ? { ...r, ...patch } : r)));
  }
  async function save() {
    if (!rules) return;
    setBusy(true);
    try {
      for (let d = 0; d < 7; d++) {
        const r = rules[d];
        const body = {
          dayOfWeek: d,
          startTime: r.startTime,
          endTime: r.endTime,
          slotDurationMinutes: r.slotDurationMinutes,
          isActive: r.enabled,
          consultationTypes: ['IN_PERSON', 'TELEHEALTH'],
        };
        if (r.id) await publicAdminApi.updateAvailabilityRule(t, r.id, body);
        else if (r.enabled) await publicAdminApi.createAvailabilityRule(t, { doctorId: doctor.doctorId, ...body });
      }
      toast.success('Availability saved.');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Weekly hours — ${doctor.displayName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!rules} onClick={save}>
            Save hours
          </Button>
        </>
      }
    >
      {!rules ? (
        <Spinner label="Loading…" />
      ) : (
        <div className="space-y-2">
          {rules.map((r, d) => (
            <div key={d} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2.5">
              <label className="flex w-20 items-center gap-2 text-body-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => setDay(d, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />{' '}
                {DAYS[d]}
              </label>
              <Input
                type="time"
                value={r.startTime}
                onChange={(e) => setDay(d, { startTime: e.target.value })}
                className="w-28"
                disabled={!r.enabled}
              />
              <span className="text-ink-soft">–</span>
              <Input
                type="time"
                value={r.endTime}
                onChange={(e) => setDay(d, { endTime: e.target.value })}
                className="w-28"
                disabled={!r.enabled}
              />
              <Select
                value={String(r.slotDurationMinutes)}
                onChange={(e) => setDay(d, { slotDurationMinutes: Number(e.target.value) })}
                className="w-28"
                disabled={!r.enabled}
              >
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Portal access requests ────────────────────────────────────
function AccessTab({ t }: { t: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<AccessRequest[] | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const load = useCallback(() => {
    publicAdminApi
      .listAccessRequests(t)
      .then(setRows)
      .catch((e) => toast.error((e as Error).message));
  }, [t, toast]);
  useEffect(() => load(), [load]);
  async function act(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      toast.success(label);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (!rows) return <Spinner label="Loading…" />;
  return (
    <Section title="Patient portal access requests">
      <p className="px-5 pt-4 text-body-sm text-ink-muted">Patients asking to link to their existing records here.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3">Patient</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Requested</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink-soft">
                  No pending access requests.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{r.patient?.fullName ?? '—'}</div>
                  <div className="text-label-sm text-ink-soft">{r.patient ? `MRN ${r.patient.mrn}` : ''}</div>
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {[r.patient?.phone, r.email].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-5 py-3 text-ink-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      icon={UserCheck}
                      onClick={() => act('Access approved.', () => publicAdminApi.approveAccessRequest(t, r.id))}
                    >
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" icon={X} onClick={() => setRejectId(r.id)}>
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReasonModal
        open={!!rejectId}
        title="Reject access request"
        description="The patient will not be linked to this hospital's records."
        confirmLabel="Reject"
        onClose={() => setRejectId(null)}
        onConfirm={async (reason) => {
          const id = rejectId!;
          setRejectId(null);
          await act('Request rejected.', () => publicAdminApi.rejectAccess(t, id, reason));
        }}
      />
    </Section>
  );
}

export default function PublicProfileAdminPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <Inner />
    </Protected>
  );
}
