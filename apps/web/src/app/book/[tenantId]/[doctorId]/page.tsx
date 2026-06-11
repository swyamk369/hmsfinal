'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Stethoscope, Video, User } from 'lucide-react';
import { PublicShell } from '@/components/public-shell';
import { publicApi, inr, type BookingOptions, type DaySlots, type BookingResult } from '@/lib/public';

type Step = 1 | 2 | 3 | 4 | 5;

export default function BookPage() {
  const { tenantId, doctorId } = useParams<{ tenantId: string; doctorId: string }>();
  const [opts, setOpts] = useState<BookingOptions | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);

  const [typeId, setTypeId] = useState<string>('');
  const [consult, setConsult] = useState<string>('IN_PERSON');
  const [slots, setSlots] = useState<DaySlots[] | null>(null);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [form, setForm] = useState({ fullName: '', dateOfBirth: '', email: '', mobile: '', reasonForVisit: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  useEffect(() => {
    publicApi
      .bookingOptions(tenantId, doctorId)
      .then((o) => {
        setOpts(o);
        if (o.consultationTypes[0]) setConsult(o.consultationTypes[0]);
      })
      .catch((e) => setErr((e as Error).message));
  }, [tenantId, doctorId]);

  const loadSlots = useCallback(async () => {
    setSlots(null);
    try {
      setSlots(await publicApi.bookingSlots(tenantId, doctorId, undefined, 14, typeId || undefined));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [tenantId, doctorId, typeId]);

  useEffect(() => {
    if (step === 2) void loadSlots();
  }, [step, loadSlots]);

  const selectedType = useMemo(() => opts?.appointmentTypes.find((t) => t.id === typeId), [opts, typeId]);

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      const res = await publicApi.createBooking({
        tenantId,
        doctorId,
        appointmentTypeId: typeId || undefined,
        date,
        time,
        consultationType: consult,
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        email: form.email.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        reasonForVisit: form.reasonForVisit.trim() || undefined,
        newOrExistingPatient: 'NEW',
      });
      setResult(res);
      setStep(5);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !opts) {
    return (
      <PublicShell>
        <div className="rounded-lg border border-line bg-surface px-6 py-12 text-center text-body-sm text-ink-muted">{err}</div>
      </PublicShell>
    );
  }
  if (!opts) {
    return (
      <PublicShell>
        <p className="py-10 text-center text-body-sm text-ink-soft">Loading…</p>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Link href="/doctors" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-100 text-primary-700">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold text-ink">{opts.doctor}</div>
            <div className="text-body-sm text-ink-muted">
              {opts.specialty ? `${opts.specialty} · ` : ''}
              {opts.hospital}
            </div>
          </div>
        </div>

        {step < 5 && <Stepper step={step} />}
        {err && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{err}</div>}

        {step === 1 && (
          <Card title="What do you need?">
            <Label>Appointment type</Label>
            <div className="space-y-2">
              {opts.appointmentTypes.length === 0 && <p className="text-body-sm text-ink-soft">No appointment types configured.</p>}
              {opts.appointmentTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeId(t.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${typeId === t.id ? 'border-primary bg-primary-50' : 'border-line hover:border-primary'}`}
                >
                  <span>
                    <span className="font-medium text-ink">{t.name}</span>
                    <span className="ml-2 text-body-sm text-ink-muted">{t.durationMinutes} min</span>
                  </span>
                  <span className="font-semibold text-ink">{inr(t.price)}</span>
                </button>
              ))}
            </div>
            <Label className="mt-4">Consultation type</Label>
            <div className="flex gap-2">
              {opts.consultationTypes.map((c) => (
                <button
                  key={c}
                  onClick={() => setConsult(c)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-body-sm ${consult === c ? 'border-primary bg-primary-50 text-primary' : 'border-line text-ink-muted'}`}
                >
                  {c === 'TELEHEALTH' ? <Video className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  {c === 'TELEHEALTH' ? 'Telehealth' : 'In-person'}
                </button>
              ))}
            </div>
            <Next onClick={() => setStep(2)} disabled={opts.appointmentTypes.length > 0 && !typeId}>
              Choose a time
            </Next>
          </Card>
        )}

        {step === 2 && (
          <Card title="Pick a time">
            {!slots && <p className="text-body-sm text-ink-soft">Finding available slots…</p>}
            {slots && slots.length === 0 && <p className="text-body-sm text-ink-muted">No available slots in the next two weeks. Please contact the clinic.</p>}
            <div className="space-y-4">
              {(slots ?? []).map((d) => (
                <div key={d.date}>
                  <div className="mb-2 flex items-center gap-1.5 text-body-sm font-medium text-ink">
                    <CalendarDays className="h-4 w-4 text-ink-muted" /> {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.slots.map((s) => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => {
                          setDate(d.date);
                          setTime(s.time);
                          setStep(3);
                        }}
                        className={`rounded-md border px-3 py-1.5 text-body-sm ${
                          !s.available ? 'cursor-not-allowed border-line text-ink-soft line-through opacity-50' : 'border-line text-ink hover:border-primary hover:bg-primary-50'
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="mt-4 text-body-sm font-medium text-ink-muted hover:text-primary">
              ← Back
            </button>
          </Card>
        )}

        {step === 3 && (
          <Card title="Your details">
            <Field label="Full name" required>
              <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth">
                <input type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              </Field>
              <Field label="Mobile">
                <input className={inputCls} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <p className="-mt-1 mb-3 text-label-sm text-ink-soft">Provide an email or mobile so the clinic can reach you.</p>
            <Field label="Reason for visit">
              <textarea rows={2} className={inputCls} value={form.reasonForVisit} onChange={(e) => setForm({ ...form, reasonForVisit: e.target.value })} />
            </Field>
            <Next onClick={() => setStep(4)} disabled={!form.fullName.trim() || (!form.email.trim() && !form.mobile.trim())}>
              Review
            </Next>
            <button onClick={() => setStep(2)} className="mt-2 w-full text-body-sm font-medium text-ink-muted hover:text-primary">
              ← Back
            </button>
          </Card>
        )}

        {step === 4 && (
          <Card title="Review & confirm">
            <dl className="divide-y divide-line text-body-sm">
              <Row k="Doctor" v={opts.doctor} />
              <Row k="Hospital" v={opts.hospital} />
              {selectedType && <Row k="Appointment" v={`${selectedType.name} · ${inr(selectedType.price)}`} />}
              <Row k="Type" v={consult === 'TELEHEALTH' ? 'Telehealth' : 'In-person'} />
              <Row k="When" v={`${new Date(date).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short' })} at ${time}`} />
              <Row k="Patient" v={form.fullName} />
              <Row k="Contact" v={[form.mobile, form.email].filter(Boolean).join(' · ')} />
            </dl>
            <button onClick={confirm} disabled={busy} className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? 'Confirming…' : 'Confirm booking'}
            </button>
            <button onClick={() => setStep(3)} className="mt-2 w-full text-body-sm font-medium text-ink-muted hover:text-primary">
              ← Back
            </button>
          </Card>
        )}

        {step === 5 && result && (
          <Card title="">
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
              <h2 className="text-title-lg font-semibold text-ink">{result.requiresApproval ? 'Booking request received' : 'Appointment confirmed'}</h2>
              <p className="mt-1 text-body-md text-ink-muted">
                {result.requiresApproval
                  ? 'The clinic will review your request and confirm shortly.'
                  : 'Your appointment is confirmed. See you soon!'}
              </p>
              <div className="mx-auto mt-5 max-w-sm rounded-lg border border-line bg-canvas p-4 text-left text-body-sm">
                <div className="font-medium text-ink">{result.doctor}</div>
                <div className="text-ink-muted">{result.hospital}</div>
                <div className="mt-2 flex items-center gap-1.5 text-ink">
                  <Clock className="h-4 w-4 text-ink-muted" />
                  {new Date(result.date).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short' })} at {result.time}
                </div>
                <div className="mt-1 text-label-sm text-ink-soft">Reference: {result.bookingId.slice(0, 8)}</div>
              </div>
              <Link href="/doctors" className="mt-6 inline-block text-body-sm font-medium text-primary hover:underline">
                Find more doctors
              </Link>
            </div>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}

const inputCls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      {title && <h2 className="mb-4 text-title-lg font-semibold text-ink">{title}</h2>}
      {children}
    </div>
  );
}
function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-2 text-label-md uppercase text-ink-soft ${className}`}>{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-body-sm font-medium text-ink">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}
function Next({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
      {children}
    </button>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}
function Stepper({ step }: { step: number }) {
  const labels = ['Service', 'Time', 'Details', 'Confirm'];
  return (
    <div className="mb-5 flex items-center gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <span className={`grid h-6 w-6 place-items-center rounded-full text-label-sm font-semibold ${i + 1 <= step ? 'bg-primary text-white' : 'bg-canvas text-ink-soft'}`}>{i + 1}</span>
          <span className={`text-label-sm ${i + 1 <= step ? 'text-ink' : 'text-ink-soft'}`}>{l}</span>
          {i < labels.length - 1 && <span className="h-px flex-1 bg-line" />}
        </div>
      ))}
    </div>
  );
}
