'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock, MapPin, CalendarPlus, Video } from 'lucide-react';
import { usePortal } from '@/components/patient/portal-shell';
import { useData, Loading, ErrorState, EmptyState, StatusBadge, SubTabs } from '@/components/patient/portal-ui';
import { portalApi, type PortalAppointment } from '@/lib/patient-portal';

type Bucket = 'upcoming' | 'past' | 'pending' | 'cancelled';
const PENDING = ['PENDING', 'PENDING_STAFF_APPROVAL', 'UNDER_REVIEW'];
const CLOSED = ['CANCELLED', 'REJECTED', 'NO_SHOW'];

function bucketOf(a: PortalAppointment): Bucket {
  const s = a.status.toUpperCase();
  if (CLOSED.includes(s)) return 'cancelled';
  if (PENDING.includes(s)) return 'pending';
  return new Date(a.scheduledAt).getTime() >= Date.now() ? 'upcoming' : 'past';
}

export default function AppointmentsPage() {
  const { tenantId, current, openLinkModal } = usePortal();
  const [tab, setTab] = useState<Bucket>('upcoming');

  if (!tenantId) return <NoHospital onLink={openLinkModal} />;
  return <AppointmentsInner tenantId={tenantId} cityHint={current?.city ?? null} tab={tab} setTab={setTab} />;
}

function AppointmentsInner({ tenantId, cityHint, tab, setTab }: { tenantId: string; cityHint: string | null; tab: Bucket; setTab: (b: Bucket) => void }) {
  const { data, err } = useData<PortalAppointment[]>(() => portalApi.appointments(tenantId), [tenantId]);
  if (err) return <ErrorState msg={err} />;
  if (!data) return <Loading label="Loading appointments…" />;

  const counts: Record<Bucket, number> = { upcoming: 0, past: 0, pending: 0, cancelled: 0 };
  data.forEach((a) => (counts[bucketOf(a)] += 1));
  const rows = data.filter((a) => bucketOf(a) === tab).sort((x, y) => +new Date(y.scheduledAt) - +new Date(x.scheduledAt));

  return (
    <div>
      <SubTabs<Bucket>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
          { key: 'past', label: 'Past', count: counts.past },
          { key: 'pending', label: 'Pending', count: counts.pending },
          { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`No ${tab} appointments`}
          body={tab === 'upcoming' ? 'Book a visit with a doctor and it will show up here.' : undefined}
          action={tab === 'upcoming' ? <Link href="/doctors" className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">Find a doctor</Link> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <Row key={a.id} a={a} cityHint={cityHint} upcoming={tab === 'upcoming'} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ a, cityHint, upcoming }: { a: PortalAppointment; cityHint: string | null; upcoming: boolean }) {
  const tele = a.consultationType === 'TELEHEALTH';
  const when = new Date(a.scheduledAt);
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 font-medium text-ink">
            <Clock className="h-4 w-4 text-ink-muted" />
            {when.toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-body-sm text-ink-muted">
            {tele ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {a.doctorName ?? 'Doctor'} · {tele ? 'Telehealth' : 'In-person'}
          </div>
          {a.reason && <div className="mt-1 text-body-sm text-ink-soft">{a.reason}</div>}
        </div>
        <StatusBadge status={a.status} />
      </div>
      {upcoming && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <button onClick={() => downloadIcs(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-body-sm font-medium text-ink hover:bg-canvas">
            <CalendarPlus className="h-4 w-4" /> Add to Calendar
          </button>
          {!tele && cityHint && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cityHint)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-body-sm font-medium text-ink hover:bg-canvas"
            >
              <MapPin className="h-4 w-4" /> Directions
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Honest .ics export — calendars consume this directly; no third-party service.
function downloadIcs(a: PortalAppointment) {
  const start = new Date(a.scheduledAt);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HealthConnect//Patient Portal//EN',
    'BEGIN:VEVENT',
    `UID:${a.id}@healthconnect`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Appointment with ${a.doctorName ?? 'Doctor'}`,
    `DESCRIPTION:${a.consultationType === 'TELEHEALTH' ? 'Telehealth consultation' : 'In-person consultation'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `appointment-${a.id}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function NoHospital({ onLink }: { onLink: () => void }) {
  return (
    <EmptyState
      icon={CalendarDays}
      title="Link a hospital to see appointments"
      body="Your appointments appear once you've linked a hospital record."
      action={<button onClick={onLink} className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">Link a record</button>}
    />
  );
}
