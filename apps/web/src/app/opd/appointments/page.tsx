'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Search, CalendarClock, Ban } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { patientsApi, type Patient } from '@/lib/patients';
import { opdApi, type Appointment, type DoctorRef } from '@/lib/opd';
import { formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  ReasonModal,
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

function AppointmentsInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Appointment[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [reschedule, setReschedule] = useState<Appointment | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await opdApi.listAppointments(t, { date }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, date]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (t)
      opdApi
        .doctors(t)
        .then(setDoctors)
        .catch(() => {});
  }, [t]);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setBookOpen(true);
  }, []);

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Schedule and manage patient appointments"
        action={
          <Button icon={CalendarPlus} onClick={() => setBookOpen(true)}>
            Book Appointment
          </Button>
        }
      />

      {err && <ErrorState message={err} />}

      <Section
        title="Schedule"
        action={
          <div className="flex items-center gap-2">
            <span className="text-label-sm text-ink-soft">Date</span>
            <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        }
      >
        {!rows ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={CalendarClock}
              title="No appointments for this date"
              action={
                <Button size="sm" icon={CalendarPlus} onClick={() => setBookOpen(true)}>
                  Book Appointment
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-medium text-ink">
                      {new Date(a.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{a.patient?.fullName ?? 'Patient'}</div>
                      <div className="text-label-sm text-ink-soft">{a.patient?.mrn}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{a.reason || '—'}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={a.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!['CANCELLED', 'COMPLETED'].includes(a.status) && (
                          <>
                            <Button size="sm" variant="ghost" icon={CalendarClock} onClick={() => setReschedule(a)}>
                              Reschedule
                            </Button>
                            <Button size="sm" variant="ghost" icon={Ban} onClick={() => setCancelId(a.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <BookModal open={bookOpen} doctors={doctors} onClose={() => setBookOpen(false)} onSaved={load} />
      <RescheduleModal appt={reschedule} onClose={() => setReschedule(null)} onSaved={load} />
      <ReasonModal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel appointment"
        confirmLabel="Cancel appointment"
        onConfirm={async (reason) => {
          await opdApi.cancelAppointment(t, cancelId!, reason);
          toast.success('Appointment cancelled.');
          await load();
        }}
      />
    </>
  );
}

function PatientPicker({ value, onChange }: { value: Patient | null; onChange: (p: Patient | null) => void }) {
  const { activeTenantId } = useAuth();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Patient[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setResults(await patientsApi.list(activeTenantId, term.trim()));
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-line bg-canvas px-3 py-2 text-body-sm">
        <span>
          <span className="font-medium text-ink">{value.fullName}</span>{' '}
          <span className="text-ink-soft">· {value.mrn}</span>
        </span>
        <button type="button" className="text-label-sm text-primary hover:underline" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div>
      <form onSubmit={search} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <Input
          className="pl-8"
          placeholder="Search patient by name/MRN…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </form>
      {results && (
        <ul className="mt-2 max-h-40 divide-y divide-line overflow-y-auto rounded-md border border-line">
          {results.length === 0 && <li className="px-3 py-2 text-label-sm text-ink-soft">No match</li>}
          {results.slice(0, 6).map((p) => (
            <li
              key={p.id}
              onClick={() => onChange(p)}
              className="cursor-pointer px-3 py-2 text-body-sm hover:bg-canvas"
            >
              <span className="font-medium text-ink">{p.fullName}</span>{' '}
              <span className="text-ink-soft">· {p.mrn}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BookModal({
  open,
  doctors,
  onClose,
  onSaved,
}: {
  open: boolean;
  doctors: DoctorRef[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [providerId, setProviderId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPatient(null);
      setProviderId('');
      setDate(new Date().toISOString().slice(0, 10));
      setTime('09:00');
      setReason('');
    }
  }, [open]);

  async function submit() {
    if (!activeTenantId || !patient) return;
    setBusy(true);
    try {
      await opdApi.bookAppointment(activeTenantId, {
        patientId: patient.id,
        providerId: providerId || undefined,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        reason: reason.trim() || undefined,
      });
      toast.success('Appointment booked.');
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
      title="Book Appointment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!patient}>
            Confirm booking
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Patient" required>
          <PatientPicker value={patient} onChange={setPatient} />
        </FormField>
        <FormField label="Physician">
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="Time" required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Reason for visit">
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Brief description of symptoms…"
          />
        </FormField>
      </div>
    </Modal>
  );
}

function RescheduleModal({
  appt,
  onClose,
  onSaved,
}: {
  appt: Appointment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (appt) {
      const d = new Date(appt.scheduledAt);
      setDate(d.toISOString().slice(0, 10));
      setTime(d.toTimeString().slice(0, 5));
      setReason('');
    }
  }, [appt]);

  async function submit() {
    if (!activeTenantId || !appt) return;
    if (!reason.trim()) {
      toast.error('A reason is required.');
      return;
    }
    setBusy(true);
    try {
      await opdApi.rescheduleAppointment(
        activeTenantId,
        appt.id,
        new Date(`${date}T${time}`).toISOString(),
        reason.trim(),
      );
      toast.success('Appointment rescheduled.');
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
      open={!!appt}
      onClose={onClose}
      title="Reschedule appointment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!reason.trim()}>
            Reschedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="New date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>
          <FormField label="New time" required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Reason" required>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being rescheduled?"
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default function AppointmentsPage() {
  return (
    <Protected requireModule="OPD" allowedRoles={['RECEPTION', 'HOSPITAL_ADMIN']}>
      <AppointmentsInner />
    </Protected>
  );
}
