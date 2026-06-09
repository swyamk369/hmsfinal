'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Users, Search } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { patientsApi, type Patient } from '@/lib/patients';
import { ageFromDob, formatDateTime } from '@/lib/format';
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
} from '@/components/ui';

function PatientsInner() {
  const { activeTenantId } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Patient[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async (q?: string) => {
      if (!activeTenantId) return;
      setErr(null);
      try {
        setRows(await patientsApi.list(activeTenantId, q));
      } catch (e) {
        setErr((e as Error).message);
      }
    },
    [activeTenantId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setCreating(true);
  }, []);

  return (
    <>
      <PageHeader
        title="Patient Directory"
        subtitle="Search, register, and manage patients"
        action={
          <Button icon={UserPlus} onClick={() => setCreating(true)}>
            Register Patient
          </Button>
        }
      />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading patients…" />}

      {rows && (
        <Section
          title={`${rows.length} patient${rows.length === 1 ? '' : 's'}`}
          action={
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load(search.trim());
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <Input
                className="w-56 pl-8"
                placeholder="Search MRN, name, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          }
        >
          {rows.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState
                icon={Users}
                title="No patients found"
                hint="Register your first patient to start the OPD workflow."
                action={
                  <Button icon={UserPlus} onClick={() => setCreating(true)}>
                    Register Patient
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-3 font-medium">MRN</th>
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium">Age/Sex</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Registered</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-canvas"
                      onClick={() => router.push(`/patients/${p.id}`)}
                    >
                      <td className="px-5 py-3 font-mono text-ink-muted">{p.mrn}</td>
                      <td className="px-5 py-3 font-medium text-ink">{p.fullName}</td>
                      <td className="px-5 py-3 text-ink-muted">
                        {ageFromDob(p.dob)} / {p.sex?.[0] ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{p.phone || '—'}</td>
                      <td className="px-5 py-3 text-ink-muted">{formatDateTime(p.createdAt)}</td>
                      <td className="px-5 py-3">
                        <StatusChip status={p.deletedAt ? 'ARCHIVED' : 'ACTIVE'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <RegisterModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(p) => {
          toast.success(`Registered ${p.fullName} (${p.mrn}).`);
          router.push(`/patients/${p.id}`);
        }}
      />
    </>
  );
}

function RegisterModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (p: Patient) => void;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const empty = {
    fullName: '',
    dob: '',
    sex: '',
    phone: '',
    email: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    consent: true,
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(empty);
      setErrs({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!activeTenantId) return;
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const p = await patientsApi.register(activeTenantId, {
        fullName: form.fullName.trim(),
        dob: form.dob || undefined,
        sex: form.sex || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        consent: form.consent,
      });
      onCreated(p);
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
      title="Register Patient"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!form.fullName.trim()}>
            Save &amp; create record
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Full legal name" required error={errs.fullName}>
          <Input
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder="Jane Doe"
            autoFocus
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date of birth">
            <Input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
          </FormField>
          <FormField label="Sex">
            <Select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
              <option value="">Select…</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" />
          </FormField>
          <FormField label="Email" error={errs.email}>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Address">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Emergency contact">
            <Input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} />
          </FormField>
          <FormField label="Emergency phone">
            <Input value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} />
          </FormField>
        </div>
        <label className="flex items-start gap-2 rounded-md border border-line bg-canvas p-3">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => set('consent', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary"
          />
          <span className="text-body-sm text-ink-muted">
            Patient/guardian consents to data processing &amp; treatment (records an initial consent).
          </span>
        </label>
      </div>
    </Modal>
  );
}

export default function PatientsPage() {
  return (
    <Protected requireModule="PATIENT">
      <PatientsInner />
    </Protected>
  );
}
