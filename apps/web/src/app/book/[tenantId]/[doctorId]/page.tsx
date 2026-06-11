'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ListChecks,
  Lock,
  MapPin,
  ShieldCheck,
  User,
  Video,
} from 'lucide-react';
import {
  BookingChrome,
  ProviderCard,
  ServiceOption,
  groupByPartOfDay,
} from '@/components/patient/booking-ui';
import { publicApi, inr, type BookingOptions, type DaySlots, type BookingResult } from '@/lib/public';

type Screen = 'choose' | 'details' | 'review' | 'confirmed';

interface PatientForm {
  fullName: string;
  dateOfBirth: string;
  email: string;
  mobile: string;
  reasonForVisit: string;
}

export default function BookPage() {
  const { tenantId, doctorId } = useParams<{ tenantId: string; doctorId: string }>();
  const router = useRouter();

  const [opts, setOpts] = useState<BookingOptions | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('choose');

  const [typeId, setTypeId] = useState('');
  const [consult, setConsult] = useState('IN_PERSON');
  const [slots, setSlots] = useState<DaySlots[] | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [form, setForm] = useState<PatientForm>({ fullName: '', dateOfBirth: '', email: '', mobile: '', reasonForVisit: '' });
  const [consents, setConsents] = useState({ terms: false, records: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);

  useEffect(() => {
    publicApi
      .bookingOptions(tenantId, doctorId)
      .then((o) => {
        setOpts(o);
        if (o.appointmentTypes[0]) setTypeId(o.appointmentTypes[0].id);
        if (o.consultationTypes[0]) setConsult(o.consultationTypes[0]);
      })
      .catch((e) => setLoadErr((e as Error).message));
  }, [tenantId, doctorId]);

  const loadSlots = useCallback(async () => {
    setSlots(null);
    try {
      const days = await publicApi.bookingSlots(tenantId, doctorId, undefined, 14, typeId || undefined);
      setSlots(days);
      const firstWithSlot = days.find((d) => d.slots.some((s) => s.available));
      if (firstWithSlot && !date) setDate(firstWithSlot.date);
    } catch (e) {
      setErr((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, doctorId, typeId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const selectedType = useMemo(() => opts?.appointmentTypes.find((t) => t.id === typeId), [opts, typeId]);
  const datesWithSlots = useMemo(() => (slots ?? []).filter((d) => d.slots.some((s) => s.available)), [slots]);
  const activeDay = useMemo(() => datesWithSlots.find((d) => d.date === date) ?? null, [datesWithSlots, date]);
  const stepperCurrent = screen === 'choose' ? (time ? 2 : 1) : screen === 'details' ? 3 : screen === 'review' ? 4 : 5;

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
      setScreen('confirmed');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loadErr) {
    return (
      <BookingChrome current={1} onClose={() => router.push('/doctors')}>
        <div className="mx-auto max-w-md rounded-xl border border-line bg-surface px-6 py-12 text-center text-body-md text-ink-muted">
          {loadErr}
          <div className="mt-4">
            <Link href="/doctors" className="text-body-sm font-medium text-primary hover:underline">
              Back to doctors
            </Link>
          </div>
        </div>
      </BookingChrome>
    );
  }
  if (!opts) {
    return (
      <BookingChrome current={1} onClose={() => router.push('/doctors')}>
        <p className="py-16 text-center text-body-sm text-ink-soft">Loading booking…</p>
      </BookingChrome>
    );
  }

  const contactOk = !!form.email.trim() || !!form.mobile.trim();
  const detailsValid = !!form.fullName.trim() && contactOk;
  const consentOk = consents.terms && consents.records;

  // ── Confirmation ──────────────────────────────────────────────
  if (screen === 'confirmed' && result) {
    return (
      <BookingChrome current={5} onClose={() => router.push('/patient/dashboard')}>
        <Confirmation result={result} />
      </BookingChrome>
    );
  }

  return (
    <BookingChrome
      current={stepperCurrent}
      onClose={() => router.push(`/doctors`)}
      footer={
        screen === 'choose' ? (
          <>
            <div className="hidden flex-col md:flex">
              <span className="text-body-sm text-ink-soft">Selected</span>
              <span className="text-label-md text-ink">
                {selectedType ? selectedType.name : 'Appointment'}
                {date && time ? ` · ${formatDay(date)}, ${time}` : ''}
              </span>
            </div>
            <button
              onClick={() => setScreen('details')}
              disabled={(opts.appointmentTypes.length > 0 && !typeId) || !date || !time}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-label-md text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              Continue to details <ArrowRight className="h-5 w-5" />
            </button>
          </>
        ) : screen === 'details' ? (
          <>
            <button onClick={() => setScreen('choose')} className="inline-flex items-center gap-1.5 text-label-md text-ink-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setScreen('review')}
              disabled={!detailsValid}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-label-md text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              Review booking <ArrowRight className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setScreen('details')} className="inline-flex items-center gap-1.5 text-label-md text-ink-muted hover:text-ink">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={confirm}
              disabled={busy || !consentOk}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-label-md text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" /> {busy ? 'Confirming…' : 'Confirm booking'}
            </button>
          </>
        )
      }
    >
      {err && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{err}</div>
      )}

      {screen === 'choose' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: provider + service */}
          <div className="flex flex-col gap-5 lg:col-span-5">
            <ProviderCard name={opts.doctor} specialty={opts.specialty} hospital={opts.hospital} acceptsNew />
            <section className="flex flex-col gap-3">
              <h3 className="text-headline-sm text-ink">Select a service</h3>
              {opts.appointmentTypes.length === 0 && (
                <p className="rounded-lg border border-line bg-surface p-4 text-body-sm text-ink-soft">
                  No appointment types are configured for this doctor. Please contact the hospital.
                </p>
              )}
              {opts.appointmentTypes.map((t) => (
                <ServiceOption
                  key={t.id}
                  selected={typeId === t.id}
                  name={t.name}
                  durationMinutes={t.durationMinutes}
                  priceLabel={inr(t.price)}
                  onSelect={() => setTypeId(t.id)}
                />
              ))}
              {opts.consultationTypes.length > 1 && (
                <>
                  <h4 className="mt-2 text-label-md uppercase text-ink-soft">Consultation type</h4>
                  <div className="flex gap-2">
                    {opts.consultationTypes.map((c) => (
                      <button
                        key={c}
                        onClick={() => setConsult(c)}
                        className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-body-sm transition-colors ${
                          consult === c ? 'border-primary bg-primary-50 text-primary' : 'border-line text-ink-muted hover:border-primary'
                        }`}
                      >
                        {c === 'TELEHEALTH' ? <Video className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        {c === 'TELEHEALTH' ? 'Telehealth' : 'In-person'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Right: date + time */}
          <div className="lg:col-span-7">
            <section className="flex h-full flex-col gap-5 rounded-xl border border-line bg-surface p-4 md:p-6">
              <div>
                <h3 className="text-headline-sm text-ink">Pick a date</h3>
                {!slots && <p className="mt-3 text-body-sm text-ink-soft">Finding available days…</p>}
                {slots && datesWithSlots.length === 0 && (
                  <p className="mt-3 text-body-sm text-ink-muted">No availability in the next two weeks. Please contact the clinic.</p>
                )}
                {datesWithSlots.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {datesWithSlots.map((d) => {
                      const sel = d.date === date;
                      const dt = new Date(d.date);
                      return (
                        <button
                          key={d.date}
                          onClick={() => {
                            setDate(d.date);
                            setTime('');
                          }}
                          className={`flex min-w-[68px] flex-col items-center rounded-xl border px-3 py-2 transition-colors ${
                            sel ? 'border-primary bg-primary text-white' : 'border-line text-ink hover:border-primary'
                          }`}
                        >
                          <span className={`text-label-sm uppercase ${sel ? 'text-white/80' : 'text-ink-soft'}`}>
                            {dt.toLocaleDateString(undefined, { weekday: 'short' })}
                          </span>
                          <span className="text-headline-sm">{dt.getDate()}</span>
                          <span className={`text-label-sm ${sel ? 'text-white/80' : 'text-ink-soft'}`}>
                            {dt.toLocaleDateString(undefined, { month: 'short' })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {activeDay && (
                <div className="border-t border-line pt-4">
                  <h3 className="text-headline-sm text-ink">Available times</h3>
                  <p className="mb-3 text-body-sm text-ink-muted">{formatDay(activeDay.date, true)}</p>
                  <div className="space-y-4">
                    {groupByPartOfDay(activeDay.slots).map((grp) => (
                      <div key={grp.label}>
                        <h4 className="mb-2 text-label-sm uppercase tracking-wide text-ink-soft">{grp.label}</h4>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {grp.slots.map((s) => {
                            const sel = time === s.time;
                            return (
                              <button
                                key={s.time}
                                disabled={!s.available}
                                onClick={() => setTime(s.time)}
                                className={`rounded-lg border px-3 py-2 text-label-md transition-all ${
                                  !s.available
                                    ? 'cursor-not-allowed border-line text-ink-soft line-through opacity-50'
                                    : sel
                                      ? 'border-2 border-primary bg-primary text-white shadow-sm'
                                      : 'border-line text-ink hover:border-primary hover:bg-primary-50'
                                }`}
                              >
                                {s.time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {screen === 'details' && (
        <div className="mx-auto max-w-2xl">
          <h2 className="text-headline-md text-ink">Patient details</h2>
          <p className="mb-6 text-body-md text-ink-muted">Please provide the required information to secure your appointment.</p>
          <div className="space-y-6 rounded-xl border border-line bg-surface p-5 md:p-6">
            <fieldset className="space-y-4">
              <legend className="mb-2 w-full border-b border-line pb-2 text-headline-sm text-ink">Personal information</legend>
              <Field label="Full name" required>
                <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Date of birth">
                  <input type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                </Field>
                <Field label="Mobile number">
                  <input type="tel" className={inputCls} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </Field>
              </div>
              <Field label="Email address">
                <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              {!contactOk && <p className="-mt-2 text-label-sm text-ink-soft">Provide an email or mobile so the clinic can reach you.</p>}
            </fieldset>

            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="mb-2 text-headline-sm text-ink">Visit details</legend>
              <Field label="Reason for visit">
                <textarea rows={3} className={inputCls} value={form.reasonForVisit} onChange={(e) => setForm({ ...form, reasonForVisit: e.target.value })} placeholder="Briefly describe any symptoms or concerns…" />
              </Field>
            </fieldset>

            <fieldset className="space-y-3 border-t border-line pt-4">
              <Consent
                checked={consents.terms}
                onChange={(v) => setConsents({ ...consents, terms: v })}
                label={
                  <>
                    I agree to the <span className="text-primary">Privacy Policy</span> and{' '}
                    <span className="text-primary">Terms of Service</span>.
                  </>
                }
              />
              <Consent
                checked={consents.records}
                onChange={(v) => setConsents({ ...consents, records: v })}
                label="I consent to this hospital creating and accessing my medical record for this appointment."
              />
            </fieldset>
          </div>
        </div>
      )}

      {screen === 'review' && (
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-5">
          <div className="md:col-span-3">
            <h2 className="text-headline-md text-ink">Review &amp; confirm</h2>
            <p className="mb-5 text-body-md text-ink-muted">Check everything looks right before confirming.</p>
            <dl className="divide-y divide-line rounded-xl border border-line bg-surface px-5">
              <Row k="Patient" v={form.fullName} />
              <Row k="Contact" v={[form.mobile, form.email].filter(Boolean).join(' · ') || '—'} />
              {form.reasonForVisit && <Row k="Reason" v={form.reasonForVisit} />}
              <Row k="Consultation" v={consult === 'TELEHEALTH' ? 'Telehealth' : 'In-person'} />
            </dl>
          </div>
          <aside className="md:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-xl border border-line bg-surface p-5">
                <h3 className="mb-4 flex items-center gap-2 text-headline-sm text-ink">
                  <ListChecks className="h-5 w-5 text-primary" /> Booking summary
                </h3>
                <div className="flex items-center gap-3 border-b border-line pb-4">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-100 text-label-md font-semibold text-primary-700">
                    {opts.doctor.replace(/^Dr\.?\s+/i, '').slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-label-md text-ink">{opts.doctor}</p>
                    <p className="text-body-sm text-ink-muted">{opts.specialty ?? 'Specialist'}</p>
                  </div>
                </div>
                <div className="space-y-2 border-b border-line py-4 text-body-sm">
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-ink-soft" />
                    <span className="text-ink">{formatDay(date, true)} · {time}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-ink-soft" />
                    <span className="text-ink">{opts.hospital}</span>
                  </div>
                </div>
                {selectedType && (
                  <div className="space-y-2 border-b border-line py-4 text-body-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">{selectedType.name}</span>
                      <span className="text-ink">{inr(selectedType.price)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-label-md text-ink">Total estimated</span>
                      <span className="text-headline-sm text-primary">{inr(selectedType.price)}</span>
                    </div>
                    <p className="text-label-sm text-ink-soft">Payment is collected at the clinic.</p>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 pt-4 text-ink-soft">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-label-sm">Securely processed booking</span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-line bg-canvas p-4">
                <CalendarDays className="mt-0.5 h-4 w-4 text-ink-soft" />
                <p className="text-body-sm text-ink-muted">
                  You can view, reschedule, or cancel this appointment anytime from your patient portal.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </BookingChrome>
  );
}

function Confirmation({ result }: { result: BookingResult }) {
  const pending = result.requiresApproval;
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <div className={`mb-6 grid h-24 w-24 place-items-center rounded-full ${pending ? 'bg-warning-bg' : 'bg-success-bg'}`}>
        <CheckCircle2 className={`h-12 w-12 ${pending ? 'text-warning-fg' : 'text-success-fg'}`} />
      </div>
      <h1 className="text-headline-md text-ink">{pending ? 'Booking request sent' : 'Your appointment is confirmed'}</h1>
      <p className="mt-2 max-w-md text-body-lg text-ink-muted">
        {pending
          ? 'The clinic will review your request and confirm shortly. You can track it in your patient portal.'
          : 'A confirmation is on its way. You can manage this appointment from your patient portal.'}
      </p>

      <div className="mt-8 w-full rounded-xl border border-line bg-surface p-6 text-left shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
          <span className="text-label-md uppercase tracking-wide text-ink-soft">Reference ID</span>
          <span className="rounded bg-primary-50 px-2 py-1 text-label-md text-primary">#{result.bookingId.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-100 text-label-md font-semibold text-primary-700">
              {result.doctor.replace(/^Dr\.?\s+/i, '').slice(0, 1)}
            </span>
            <div>
              <h3 className="text-body-lg font-semibold text-ink">{result.doctor}</h3>
              <p className="text-body-sm text-ink-muted">{result.hospital}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-canvas p-3">
            <span className="grid h-10 w-10 place-items-center rounded bg-primary-50 text-primary">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-body-md font-semibold text-ink">{formatDay(result.date, true)}</h3>
              <p className="flex items-center gap-1 text-body-sm text-primary">
                <Clock className="h-4 w-4" /> {result.time}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={() => downloadIcs(result)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-label-md text-white transition-colors hover:bg-primary-700"
        >
          <CalendarPlus className="h-5 w-5" /> Add to calendar
        </button>
        <Link
          href="/patient/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-6 py-3 text-label-md text-primary transition-colors hover:bg-canvas"
        >
          <LayoutDashboard className="h-5 w-5" /> Go to dashboard
        </Link>
        <Link
          href="/doctors"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-6 py-3 text-label-md text-ink transition-colors hover:bg-canvas"
        >
          Find more doctors
        </Link>
      </div>
    </section>
  );
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-label-md text-ink">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}

function Consent({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary"
      />
      <span className="text-body-sm text-ink-muted">{label}</span>
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-body-sm">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}

function formatDay(iso: string, long = false): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: long ? 'long' : 'short',
    day: '2-digit',
    month: 'short',
  });
}

/** Builds and downloads a real .ics calendar file from the confirmed booking. */
function downloadIcs(result: BookingResult) {
  const start = parseStart(result.date, result.time);
  if (!start) return;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HealthConnect//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${result.bookingId}@healthconnect`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Appointment with ${result.doctor}`,
    `LOCATION:${result.hospital}`,
    `DESCRIPTION:Reference ${result.bookingId.slice(0, 8).toUpperCase()}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appointment.ics';
  a.click();
  URL.revokeObjectURL(url);
}

function parseStart(dateIso: string, time: string): Date | null {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const d = new Date(dateIso);
  d.setHours(h, min, 0, 0);
  return d;
}
