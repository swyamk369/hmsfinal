'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, X, AlertTriangle, Link2, RefreshCw } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { bookingsApi, type OnlineBookingRow, type OnlineBookingDetail } from '@/lib/bookings';
import { formatDateTime } from '@/lib/format';
import { Button, PageHeader, Spinner, ErrorState, EmptyState, ReasonModal, Select, Modal, FormField, Input, StatusChip, Badge } from '@/components/ui';

function Inner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = new Set(profile?.tenants.find((m) => m.tenantId === activeTenantId)?.permissions ?? []);
  const canManage = ['online_booking.manage', 'online_booking.approve', 'online_booking.reject', 'online_booking.reschedule'].some((p) => perms.has(p));

  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<OnlineBookingRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<OnlineBookingRow | null>(null);
  const [linkFor, setLinkFor] = useState<OnlineBookingDetail | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await bookingsApi.list(t, status || undefined));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(label: string, fn: () => Promise<unknown>) {
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

  const pendingCount = rows?.filter((r) => r.bookingStatus === 'PENDING').length ?? 0;

  return (
    <>
      <PageHeader
        title="Online Bookings"
        subtitle="Appointments booked by patients through the public site"
        action={
          <div className="flex items-center gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Button variant="ghost" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      {pendingCount > 0 && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-2 text-body-sm text-warning-fg">
          <CalendarClock className="h-4 w-4" /> {pendingCount} booking{pendingCount === 1 ? '' : 's'} awaiting your approval
        </div>
      )}

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading bookings…" />}
      {rows && rows.length === 0 && <EmptyState icon={CalendarClock} title="No online bookings" hint="Bookings from the public site will appear here." />}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Doctor</th>
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-canvas">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 font-medium text-ink">
                      {b.fullName}
                      {b.newOrExistingPatient === 'NEW' && <Badge tone="blue">New</Badge>}
                      {b.possibleDuplicatePatient && (
                        <span className="inline-flex items-center gap-1 text-label-sm font-medium text-warning-fg">
                          <AlertTriangle className="h-3.5 w-3.5" /> Possible duplicate
                        </span>
                      )}
                    </div>
                    <div className="text-label-sm text-ink-soft">
                      {b.patient ? `MRN ${b.patient.mrn}` : ''} {[b.mobile, b.email].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{b.doctorName ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">
                    {new Date(b.appointmentDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {b.appointmentTime}
                    <div className="text-label-sm text-ink-soft">{b.consultationType === 'TELEHEALTH' ? 'Telehealth' : 'In-person'}</div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusChip status={b.bookingStatus} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {canManage && b.possibleDuplicatePatient && (
                        <Button size="sm" variant="ghost" icon={Link2} onClick={() => bookingsApi.get(t, b.id).then(setLinkFor).catch((e) => toast.error((e as Error).message))}>
                          Review
                        </Button>
                      )}
                      {canManage && b.bookingStatus === 'PENDING' && (
                        <>
                          <Button size="sm" icon={CheckCircle2} loading={busy} onClick={() => run('Booking approved.', () => bookingsApi.approve(t, b.id))}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" icon={X} onClick={() => setRejectId(b.id)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {canManage && !['REJECTED', 'CANCELLED', 'COMPLETED'].includes(b.bookingStatus) && (
                        <Button size="sm" variant="ghost" icon={CalendarClock} onClick={() => setReschedule(b)}>
                          Reschedule
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReasonModal
        open={!!rejectId}
        title="Reject booking"
        description="The patient will be notified that this booking was declined."
        confirmLabel="Reject booking"
        onClose={() => setRejectId(null)}
        onConfirm={async (reason) => {
          const id = rejectId!;
          setRejectId(null);
          await run('Booking rejected.', () => bookingsApi.reject(t, id, reason));
        }}
      />

      {reschedule && <RescheduleModal booking={reschedule} onClose={() => setReschedule(null)} onDone={(date, time) => run('Booking rescheduled.', () => bookingsApi.reschedule(t, reschedule.id, date, time)).then(() => setReschedule(null))} />}

      {linkFor && (
        <Modal open onClose={() => setLinkFor(null)} title="Possible existing patient" footer={<Button variant="ghost" onClick={() => setLinkFor(null)}>Close</Button>}>
          <p className="mb-3 text-body-sm text-ink-muted">
            This booking ({linkFor.fullName}) may match an existing patient. Link it to the correct record, or keep the new one.
          </p>
          <div className="space-y-2">
            {linkFor.duplicates.length === 0 && <p className="text-body-sm text-ink-soft">No candidates found.</p>}
            {linkFor.duplicates.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-line p-3">
                <div>
                  <div className="font-medium text-ink">{d.fullName}</div>
                  <div className="text-label-sm text-ink-soft">MRN {d.mrn} · {[d.phone, d.email].filter(Boolean).join(' · ')}</div>
                </div>
                <Button size="sm" icon={Link2} onClick={() => { const id = linkFor.id; setLinkFor(null); run('Linked to existing patient.', () => bookingsApi.linkPatient(t, id, d.id)); }}>
                  Link
                </Button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function RescheduleModal({ booking, onClose, onDone }: { booking: OnlineBookingRow; onClose: () => void; onDone: (date: string, time: string) => void }) {
  const [date, setDate] = useState(booking.appointmentDate.slice(0, 10));
  const [time, setTime] = useState(booking.appointmentTime);
  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule booking"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button icon={CalendarClock} disabled={!date || !time} onClick={() => onDone(date, time)}>Reschedule</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        <FormField label="Time">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

export default function OnlineBookingsPage() {
  return (
    <Protected requirePermission={['online_booking.read', 'online_booking.manage']}>
      <Inner />
    </Protected>
  );
}
