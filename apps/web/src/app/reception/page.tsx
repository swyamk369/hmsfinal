'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Ticket, ArrowRight } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { patientsApi, type Patient } from '@/lib/patients';
import { opdApi, type DoctorRef, type DepartmentRef, type Appointment } from '@/lib/opd';
import { ageFromDob, formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  FormField,
  Input,
  Select,
  Textarea,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  cx,
} from '@/components/ui';

function ReceptionInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const t = activeTenantId!;

  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [departments, setDepartments] = useState<DepartmentRef[]>([]);
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Patient[] | null>(null);
  const [selected, setSelected] = useState<Patient | null>(null);

  const [departmentId, setDepartmentId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastToken, setLastToken] = useState<{ token: number; name: string } | null>(null);

  const loadToday = useCallback(async () => {
    if (!t) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      setAppts(await opdApi.listAppointments(t, { date: today }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    if (!t) return;
    Promise.all([opdApi.doctors(t), opdApi.departments(t)])
      .then(([d, dept]) => {
        setDoctors(d);
        setDepartments(dept);
      })
      .catch((e) => setErr((e as Error).message));
    void loadToday();
  }, [t, loadToday]);

  async function searchPatients(e: React.FormEvent) {
    e.preventDefault();
    try {
      setResults(await patientsApi.list(t, term.trim()));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function checkIn() {
    if (!selected) return;
    setBusy(true);
    try {
      const enc = await opdApi.createEncounter(t, {
        patientId: selected.id,
        providerId: providerId || undefined,
        departmentId: departmentId || undefined,
        type: 'WALK_IN',
        chiefComplaint: complaint.trim() || undefined,
      });
      setLastToken({ token: enc.tokenNumber ?? 0, name: selected.fullName });
      toast.success(`Checked in — token #${enc.tokenNumber}.`);
      setSelected(null);
      setComplaint('');
      setProviderId('');
      setDepartmentId('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Reception"
        subtitle="Find a patient, check them into the OPD queue, and view today's schedule"
        action={
          <Link href="/patients?new=1">
            <Button icon={UserPlus}>Register Patient</Button>
          </Link>
        }
      />

      {err && <ErrorState message={err} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Walk-in check-in */}
        <div className="space-y-6 lg:col-span-2">
          <Section title="Patient lookup">
            <div className="p-5">
              <form onSubmit={searchPatients} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <Input
                    className="pl-8"
                    placeholder="Search by MRN, name, or phone"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="ghost">
                  Search
                </Button>
              </form>

              {results && results.length === 0 && (
                <div className="mt-4">
                  <EmptyState
                    title="No match"
                    hint="Register the patient, then check them in."
                    action={
                      <Link href="/patients?new=1">
                        <Button size="sm" icon={UserPlus}>
                          Register
                        </Button>
                      </Link>
                    }
                  />
                </div>
              )}
              {results && results.length > 0 && (
                <ul className="mt-3 divide-y divide-line rounded-md border border-line">
                  {results.slice(0, 8).map((p) => (
                    <li
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className={cx(
                        'flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-canvas',
                        selected?.id === p.id && 'bg-primary-50',
                      )}
                    >
                      <span className="text-body-sm">
                        <span className="font-medium text-ink">{p.fullName}</span>{' '}
                        <span className="text-ink-soft">
                          · {p.mrn} · {ageFromDob(p.dob)}/{p.sex?.[0] ?? '—'}
                        </span>
                      </span>
                      {selected?.id === p.id && (
                        <span className="text-label-sm font-medium text-primary">Selected</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="Walk-in check-in">
            <div className="space-y-4 p-5">
              {!selected ? (
                <p className="text-body-sm text-ink-soft">Search and select a patient above to check them in.</p>
              ) : (
                <>
                  <div className="rounded-md border border-line bg-canvas px-3 py-2 text-body-sm">
                    <span className="font-medium text-ink">{selected.fullName}</span>{' '}
                    <span className="text-ink-soft">· {selected.mrn}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Department">
                      <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                        <option value="">— Any —</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Doctor">
                      <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                        <option value="">— Unassigned —</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.fullName}
                            {d.speciality ? ` (${d.speciality})` : ''}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>
                  <FormField label="Chief complaint">
                    <Textarea
                      rows={2}
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      placeholder="Reason for visit…"
                    />
                  </FormField>
                  <div className="flex justify-end">
                    <Button icon={Ticket} onClick={checkIn} loading={busy}>
                      Check in &amp; generate token
                    </Button>
                  </div>
                </>
              )}

              {lastToken && (
                <div className="flex items-center justify-between rounded-md border border-success/30 bg-success-bg px-4 py-3 text-success-fg">
                  <div>
                    <div className="text-label-sm uppercase">Token issued</div>
                    <div className="text-headline-md">
                      #{lastToken.token} · {lastToken.name}
                    </div>
                  </div>
                  <Link href="/opd" className="inline-flex items-center gap-1 text-body-sm font-medium hover:underline">
                    Open queue <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Today's appointments */}
        <Section title="Today's appointments">
          {!appts ? (
            <Spinner label="Loading…" />
          ) : appts.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState title="Nothing scheduled today" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {appts.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{a.patient?.fullName ?? 'Patient'}</span>
                    <StatusChip status={a.status} />
                  </div>
                  <div className="text-label-sm text-ink-soft">
                    {formatDateTime(a.scheduledAt)}
                    {a.reason ? ` · ${a.reason}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

export default function ReceptionPage() {
  return (
    <Protected requireModule="OPD" allowedRoles={['RECEPTION', 'HOSPITAL_ADMIN']}>
      <ReceptionInner />
    </Protected>
  );
}
