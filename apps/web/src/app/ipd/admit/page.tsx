'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, UserCheck, X } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { patientsApi, type Patient } from '@/lib/patients';
import { opdApi, type DoctorRef } from '@/lib/opd';
import { ipdApi, type Bed } from '@/lib/ipd';
import { ageFromDob } from '@/lib/format';
import { Button, Section, FormField, Input, Select, Textarea, PageHeader, Spinner, Badge } from '@/components/ui';

interface WardLite {
  id: string;
  name: string;
}

function AdmitInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const toast = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [wards, setWards] = useState<WardLite[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [providerId, setProviderId] = useState('');
  const [wardId, setWardId] = useState('');
  const [bedId, setBedId] = useState('');
  const [expectedDischargeAt, setExpected] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!t) return;
    Promise.all([opdApi.doctors(t), ipdApi.occupancy(t)])
      .then(([docs, occ]) => {
        setDoctors(docs);
        setWards(occ.wards.map((w) => ({ id: w.id, name: w.name })));
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    setBedId('');
    if (!wardId) {
      setBeds([]);
      return;
    }
    ipdApi.listBeds(t, wardId).then((bs) => setBeds(bs.filter((b) => b.status === 'AVAILABLE'))).catch(() => setBeds([]));
  }, [wardId, t]);

  async function submit() {
    if (!patient || !bedId) {
      toast.error('Select a patient and an available bed.');
      return;
    }
    setBusy(true);
    try {
      const adm = await ipdApi.admit(t, {
        patientId: patient.id,
        bedId,
        providerId: providerId || undefined,
        expectedDischargeAt: expectedDischargeAt || undefined,
        reason: reason.trim() || undefined,
      });
      toast.success('Patient admitted.');
      router.push(`/ipd/admissions/${adm.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return <Spinner label="Loading admission form…" />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/ipd" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to IPD
      </Link>
      <PageHeader title="Inpatient Admission" subtitle="Assign a bed and register the admission" />

      <div className="space-y-5">
        <Section title="1. Patient">
          <div className="p-5">
            {patient ? (
              <div className="flex items-center justify-between rounded-lg border border-line bg-canvas p-3">
                <div>
                  <div className="font-medium text-ink">{patient.fullName}</div>
                  <div className="text-label-sm text-ink-soft">{patient.mrn} · {ageFromDob(patient.dob)} · {patient.sex}</div>
                </div>
                <Button size="sm" variant="ghost" icon={X} onClick={() => setPatient(null)}>Clear</Button>
              </div>
            ) : (
              <PatientPicker onPick={setPatient} />
            )}
          </div>
        </Section>

        <Section title="2. Admission details">
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="Admitting physician">
              <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.fullName}{d.speciality ? ` (${d.speciality})` : ''}</option>)}
              </Select>
            </FormField>
            <FormField label="Expected discharge">
              <Input type="date" value={expectedDischargeAt} onChange={(e) => setExpected(e.target.value)} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Presenting complaint / reason">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief clinical reason for admission" />
              </FormField>
            </div>
          </div>
        </Section>

        <Section title="3. Bed assignment">
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="Ward" required>
              <Select value={wardId} onChange={(e) => setWardId(e.target.value)}>
                <option value="">Select ward…</option>
                {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Bed (available)" required>
              <Select value={bedId} onChange={(e) => setBedId(e.target.value)} disabled={!wardId}>
                <option value="">{wardId ? 'Select bed…' : 'Pick a ward first'}</option>
                {beds.map((b) => <option key={b.id} value={b.id}>{b.bedNumber}</option>)}
              </Select>
            </FormField>
            {wardId && beds.length === 0 && (
              <div className="sm:col-span-2"><Badge tone="warning">No available beds in this ward</Badge></div>
            )}
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <Link href="/ipd"><Button variant="ghost">Cancel</Button></Link>
          <Button icon={UserCheck} onClick={submit} loading={busy} disabled={!patient || !bedId}>Admit patient</Button>
        </div>
      </div>
    </div>
  );
}

function PatientPicker({ onPick }: { onPick: (p: Patient) => void }) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await patientsApi.list(t, q.trim()));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [q, t]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <Input className="pl-8" placeholder="Search patient by name, MRN, or phone…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {loading && <p className="mt-2 text-label-sm text-ink-soft">Searching…</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-md border border-line">
          {results.slice(0, 6).map((p) => (
            <li key={p.id}>
              <button onClick={() => onPick(p)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-canvas">
                <span className="font-medium text-ink">{p.fullName}</span>
                <span className="text-label-sm text-ink-soft">{p.mrn}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdmitPage() {
  return (
    <Protected requireModule="IPD" allowedRoles={['DOCTOR', 'HOSPITAL_ADMIN', 'NURSE']} requirePermission={['ipd.admit']}>
      <AdmitInner />
    </Protected>
  );
}
