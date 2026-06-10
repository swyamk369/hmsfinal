'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CreditCard,
  ListChecks,
  RefreshCw,
  Search,
  Ticket,
  UserPlus,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { patientsApi, type Patient } from '@/lib/patients';
import { opdApi, type DoctorRef, type DepartmentRef, type Appointment, type Encounter } from '@/lib/opd';
import { ageFromDob, formatDateTime, toMinor } from '@/lib/format';
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
  StatCard,
  cx,
} from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

const RECEPTION_WORK_TYPES = ['OPD_QUEUE', 'APPOINTMENT_TODAY', 'PENDING_CHARGE', 'BILLING_RECEIVABLE'];

function ReceptionInner() {
  const { activeTenantId, profile } = useAuth();
  const toast = useToast();
  const t = activeTenantId!;
  const membership = useMemo(() => getActiveMembership(profile, activeTenantId), [activeTenantId, profile]);
  const permissions = useMemo(() => new Set(membership?.permissions ?? []), [membership]);
  const modules = useMemo(() => new Set(membership?.modules ?? []), [membership]);
  const canPostConsultCharge = modules.has('BILLING') && (permissions.has('finance.charge.manage') || permissions.has('bill.write'));
  const canOpenFinance = modules.has('BILLING') && (permissions.has('finance.cashier') || permissions.has('bill.read') || permissions.has('payment.collect'));

  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [departments, setDepartments] = useState<DepartmentRef[]>([]);
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [queue, setQueue] = useState<Encounter[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Patient[] | null>(null);
  const [selected, setSelected] = useState<Patient | null>(null);

  const [departmentId, setDepartmentId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [postConsultCharge, setPostConsultCharge] = useState(true);
  const [consultationFee, setConsultationFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastToken, setLastToken] = useState<{ token: number; name: string; patientId: string } | null>(null);

  const loadToday = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [appointments, liveQueue] = await Promise.all([
        opdApi.listAppointments(t, { date: today }),
        opdApi.queue(t),
      ]);
      setAppts(appointments);
      setQueue(liveQueue);
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

  const queueRows = queue ?? [];
  const activeQueue = queueRows.filter((e) => ['CHECKED_IN', 'IN_PROGRESS'].includes(e.status));
  const waiting = activeQueue.filter((e) => e.status === 'CHECKED_IN');
  const inConsult = activeQueue.filter((e) => e.status === 'IN_PROGRESS');
  const appointmentsToday = appts ?? [];
  const openAppointments = appointmentsToday.filter((a) => ['SCHEDULED', 'CHECKED_IN'].includes(a.status));
  const overdueAppointments = appointmentsToday.filter(
    (a) => a.status === 'SCHEDULED' && new Date(a.scheduledAt).getTime() < Date.now(),
  );

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

      let chargePosted = false;
      if (canPostConsultCharge && postConsultCharge) {
        try {
          await opdApi.chargeConsultation(t, enc.id, {
            name: 'OPD consultation',
            unitPrice: toMinor(consultationFee) ?? undefined,
          });
          chargePosted = true;
        } catch (chargeError) {
          toast.error(`Checked in, but consultation charge was not posted: ${(chargeError as Error).message}`);
        }
      }

      setLastToken({ token: enc.tokenNumber ?? 0, name: selected.fullName, patientId: selected.id });
      toast.success(`Checked in - token #${enc.tokenNumber}.${chargePosted ? ' Consultation charge is pending billing.' : ''}`);
      setSelected(null);
      setComplaint('');
      setProviderId('');
      setDepartmentId('');
      setConsultationFee('');
      await loadToday();
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
        subtitle="Front desk command center for patient lookup, appointments, OPD queue, and billing handoff"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/opd">
              <Button icon={ListChecks}>Live OPD Queue</Button>
            </Link>
            <Link href="/opd/appointments?new=1">
              <Button variant="ghost" icon={CalendarPlus}>Book Appointment</Button>
            </Link>
            <Link href="/patients?new=1">
              <Button variant="ghost" icon={UserPlus}>Register Patient</Button>
            </Link>
          </div>
        }
      />

      {err && <ErrorState message={err} />}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Waiting" value={queue ? waiting.length : '...'} hint="Checked-in patients" icon={Ticket} />
        <StatCard label="In consult" value={queue ? inConsult.length : '...'} hint="Doctor has started" icon={ListChecks} />
        <StatCard label="Appointments" value={appts ? openAppointments.length : '...'} hint={`${overdueAppointments.length} overdue`} icon={CalendarClock} />
        <StatCard label="Billing handoff" value={canOpenFinance ? 'Ready' : 'Limited'} hint="Finance access for reception" icon={WalletCards} />
      </div>

      <Section
        title="Fast actions"
        action={
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={loadToday}>
            Refresh
          </Button>
        }
        className="mb-6"
      >
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            href="/opd"
            icon={ListChecks}
            title="Open Live OPD Queue"
            body="See waiting patients, start queue actions, and track consultation status."
            primary
          />
          <QuickAction
            href="/patients?new=1"
            icon={UserPlus}
            title="Register New Patient"
            body="Create the patient record before check-in or booking."
          />
          <QuickAction
            href="/opd/appointments"
            icon={CalendarClock}
            title="Manage Appointments"
            body="Book, reschedule, or cancel today's appointments."
          />
          <QuickAction
            href={canOpenFinance ? '/finance/pending-charges' : '/billing'}
            icon={CreditCard}
            title="Billing Handoff"
            body="Review pending charges and send patients to payment."
          />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Find patient">
            <div className="p-5">
              <form onSubmit={searchPatients} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <Input
                    className="pl-8"
                    placeholder="Search by MRN, name, or phone"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="ghost">Search</Button>
              </form>

              {results && results.length === 0 && (
                <div className="mt-4">
                  <EmptyState
                    title="No patient found"
                    hint="Register the patient first, then return here for OPD check-in."
                    action={
                      <Link href="/patients?new=1">
                        <Button size="sm" icon={UserPlus}>Register Patient</Button>
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
                        'flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-canvas',
                        selected?.id === p.id && 'bg-primary-50',
                      )}
                    >
                      <span className="text-body-sm">
                        <span className="font-medium text-ink">{p.fullName}</span>{' '}
                        <span className="text-ink-soft">
                          - {p.mrn} - {ageFromDob(p.dob)}/{p.sex?.[0] ?? '-'}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Link href={`/patients/${p.id}`} className="text-label-sm font-medium text-primary hover:underline">
                          Profile
                        </Link>
                        {selected?.id === p.id && <span className="text-label-sm font-medium text-primary">Selected</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="Walk-in check-in">
            <div className="space-y-4 p-5">
              {!selected ? (
                <HelpTip title="Start with patient search">
                  Select an existing patient above, or register a new patient, then generate the OPD token from here.
                </HelpTip>
              ) : (
                <>
                  <div className="rounded-md border border-line bg-canvas px-3 py-2 text-body-sm">
                    <span className="font-medium text-ink">{selected.fullName}</span>{' '}
                    <span className="text-ink-soft">- {selected.mrn}</span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Department">
                      <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                        <option value="">Any department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Doctor">
                      <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                        <option value="">Unassigned</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.fullName}{d.speciality ? ` (${d.speciality})` : ''}
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
                      placeholder="Reason for visit"
                    />
                  </FormField>

                  {canPostConsultCharge && (
                    <div className="rounded-md border border-line bg-canvas p-3">
                      <label className="flex items-start gap-2 text-body-sm font-medium text-ink">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={postConsultCharge}
                          onChange={(e) => setPostConsultCharge(e.target.checked)}
                        />
                        <span>
                          Add OPD consultation charge
                          <span className="mt-0.5 block font-normal text-ink-soft">
                            Creates a pending charge for Finance before payment collection.
                          </span>
                        </span>
                      </label>
                      {postConsultCharge && (
                        <div className="mt-3 max-w-xs">
                          <FormField label="Fee" hint="Leave blank to use the hospital default consultation service.">
                            <Input
                              inputMode="decimal"
                              value={consultationFee}
                              onChange={(e) => setConsultationFee(e.target.value)}
                              placeholder="Default fee"
                            />
                          </FormField>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={() => setSelected(null)} disabled={busy}>Clear</Button>
                    <Button icon={Ticket} onClick={checkIn} loading={busy}>Check in &amp; generate token</Button>
                  </div>
                </>
              )}

              {lastToken && (
                <div className="rounded-md border border-success/30 bg-success-bg px-4 py-3 text-success-fg">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-label-sm uppercase">Token issued</div>
                      <div className="text-headline-md">#{lastToken.token} - {lastToken.name}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/opd">
                        <Button size="sm" icon={ListChecks}>Open Queue</Button>
                      </Link>
                      <Link href={`/finance/pending-charges?patientId=${lastToken.patientId}`}>
                        <Button size="sm" variant="ghost" icon={CreditCard}>Billing</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <WorkQueuePanel
            title="Reception work queue"
            hint="Only front-desk, queue, appointment, and billing handoff actions are shown here."
            modules={['OPD', 'SCHEDULING', 'BILLING']}
            types={RECEPTION_WORK_TYPES}
            limit={8}
          />
        </div>

        <div className="space-y-6">
          <QueueSnapshot queue={queue} />
          <AppointmentsToday appointments={appts} />
        </div>
      </div>
    </>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  body,
  primary,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  body: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        'rounded-md border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm',
        primary ? 'border-primary bg-primary-50' : 'border-line bg-surface hover:border-primary',
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cx('grid h-9 w-9 flex-shrink-0 place-items-center rounded-md', primary ? 'bg-primary text-white' : 'bg-canvas text-primary')}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-body-sm font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-body-sm text-ink-soft">{body}</span>
        </span>
      </div>
    </Link>
  );
}

function QueueSnapshot({ queue }: { queue: Encounter[] | null }) {
  const active = (queue ?? []).filter((e) => ['CHECKED_IN', 'IN_PROGRESS'].includes(e.status));
  return (
    <Section
      title="Live OPD queue"
      action={
        <Link href="/opd" className="inline-flex items-center gap-1 text-body-sm font-medium text-primary hover:underline">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {!queue ? (
        <Spinner label="Loading queue..." />
      ) : active.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState title="No active OPD queue" hint="Checked-in walk-ins and appointments appear here." />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {active.slice(0, 6).map((e) => (
            <li key={e.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-label-sm text-ink">#{e.tokenNumber ?? '-'}</span>
                    <StatusChip status={e.status} />
                  </div>
                  <Link href={`/patients/${e.patientId}`} className="mt-1 block truncate font-medium text-ink hover:text-primary">
                    {e.patient?.fullName ?? 'Patient'}
                  </Link>
                  <div className="text-label-sm text-ink-soft">{e.chiefComplaint || 'Consultation'} - {formatDateTime(e.createdAt)}</div>
                </div>
                <Link href="/opd" className="text-label-sm font-medium text-primary hover:underline">Queue</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AppointmentsToday({ appointments }: { appointments: Appointment[] | null }) {
  const open = (appointments ?? []).filter((a) => ['SCHEDULED', 'CHECKED_IN'].includes(a.status));
  return (
    <Section
      title="Today's appointments"
      action={
        <Link href="/opd/appointments" className="inline-flex items-center gap-1 text-body-sm font-medium text-primary hover:underline">
          Manage <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {!appointments ? (
        <Spinner label="Loading appointments..." />
      ) : open.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState title="Nothing scheduled now" action={<Link href="/opd/appointments?new=1"><Button size="sm" icon={CalendarPlus}>Book</Button></Link>} />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {open.slice(0, 8).map((a) => (
            <li key={a.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{a.patient?.fullName ?? 'Patient'}</div>
                  <div className="text-label-sm text-ink-soft">
                    {formatDateTime(a.scheduledAt)}{a.reason ? ` - ${a.reason}` : ''}
                  </div>
                </div>
                <StatusChip status={a.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function ReceptionPage() {
  return (
    <Protected requireModule="OPD" allowedRoles={['RECEPTION', 'HOSPITAL_ADMIN']}>
      <ReceptionInner />
    </Protected>
  );
}
