'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, Stethoscope, LogIn, Ban, CheckCircle2 } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { opdApi, type Encounter, type DoctorRef } from '@/lib/opd';
import { ageFromDob } from '@/lib/format';
import { Button, PageHeader, Spinner, ErrorState, EmptyState, ReasonModal, Select, cx } from '@/components/ui';

const COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: 'SCHEDULED', label: 'Scheduled', dot: 'bg-slate-400' },
  { key: 'CHECKED_IN', label: 'Checked In', dot: 'bg-primary' },
  { key: 'IN_PROGRESS', label: 'In Consult', dot: 'bg-success' },
  { key: 'COMPLETED', label: 'Completed', dot: 'bg-slate-300' },
];

function OpdInner() {
  const { activeTenantId, profile, activeTenantId: tid } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const toast = useToast();
  const membership = getActiveMembership(profile, tid);
  const perms = useMemo(() => new Set(membership?.permissions ?? []), [membership]);
  const has = (p: string) => perms.has(p);

  const [rows, setRows] = useState<Encounter[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorRef[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await opdApi.queue(t, doctorFilter ? { providerId: doctorFilter } : {}));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, doctorFilter]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (t && has('appointment.read'))
      opdApi
        .doctors(t)
        .then(setDoctors)
        .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  async function act(id: string, fn: () => Promise<unknown>, msg: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(msg);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, Encounter[]> = { SCHEDULED: [], CHECKED_IN: [], IN_PROGRESS: [], COMPLETED: [] };
    for (const e of rows ?? []) if (map[e.status]) map[e.status].push(e);
    return map;
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Live OPD Queue"
        subtitle="Patient flow across today's outpatient department"
        action={
          <div className="flex items-center gap-2">
            {doctors.length > 0 && (
              <Select className="w-44" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
                <option value="">All doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="ghost" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading queue…" />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon={Stethoscope}
          title="The queue is empty"
          hint="Walk-ins checked in at Reception appear here."
        />
      )}

      {rows && rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="flex flex-col rounded-xl border border-line bg-canvas">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={cx('h-2.5 w-2.5 rounded-full', col.dot)} />
                  <span className="text-title-lg text-ink">{col.label}</span>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-label-sm text-ink-soft">
                  {grouped[col.key].length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                {grouped[col.key].length === 0 && (
                  <p className="px-1 py-4 text-center text-label-sm text-ink-soft">—</p>
                )}
                {grouped[col.key].map((e) => (
                  <div key={e.id} className="rounded-lg border border-line bg-surface p-3 shadow-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-label-sm text-ink">
                        #{e.tokenNumber ?? '—'}
                      </span>
                    </div>
                    <Link href={`/patients/${e.patientId}`} className="block font-medium text-ink hover:text-primary">
                      {e.patient?.fullName ?? 'Patient'}
                    </Link>
                    <div className="text-label-sm text-ink-soft">
                      {e.patient ? `${ageFromDob(e.patient.dob)}/${e.patient.sex?.[0] ?? '—'}` : ''}
                      {e.chiefComplaint ? ` · ${e.chiefComplaint}` : ''}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                      {e.status === 'SCHEDULED' && has('queue.manage') && (
                        <Button
                          size="sm"
                          icon={LogIn}
                          onClick={() => act(e.id, () => opdApi.checkin(t, e.id), 'Checked in.')}
                          loading={busyId === e.id}
                        >
                          Check in
                        </Button>
                      )}
                      {e.status === 'CHECKED_IN' && has('consultation.write') && (
                        <Button
                          size="sm"
                          icon={Stethoscope}
                          onClick={() =>
                            act(e.id, () => opdApi.start(t, e.id), 'Consultation started.').then(() =>
                              router.push(`/doctor/consult/${e.id}`),
                            )
                          }
                          loading={busyId === e.id}
                        >
                          Start
                        </Button>
                      )}
                      {e.status === 'IN_PROGRESS' && (
                        <Link href={`/doctor/consult/${e.id}`}>
                          <Button size="sm" variant="ghost">
                            Open consult
                          </Button>
                        </Link>
                      )}
                      {['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'].includes(e.status) && has('encounter.write') && (
                        <Button size="sm" variant="ghost" icon={Ban} onClick={() => setCancelId(e.id)}>
                          Cancel
                        </Button>
                      )}
                      {e.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 text-label-sm text-success-fg">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Done
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ReasonModal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel encounter"
        confirmLabel="Cancel encounter"
        onConfirm={async (reason) => {
          await opdApi.cancelEncounter(t, cancelId!, reason);
          toast.success('Encounter cancelled.');
          await load();
        }}
      />
    </>
  );
}

export default function OpdPage() {
  return (
    <Protected requireModule="OPD" allowedRoles={['RECEPTION', 'DOCTOR', 'HOSPITAL_ADMIN']}>
      <OpdInner />
    </Protected>
  );
}
