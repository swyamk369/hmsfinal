'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Stethoscope, RefreshCw, CheckCircle2 } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { opdApi, type Encounter } from '@/lib/opd';
import { ageFromDob } from '@/lib/format';
import { Button, Section, PageHeader, StatCard, Spinner, ErrorState, EmptyState, StatusChip } from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

function DoctorInner() {
  const { profile, activeTenantId } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const toast = useToast();
  const membership = getActiveMembership(profile, activeTenantId);
  const providerId = membership?.providerId ?? '';

  const [rows, setRows] = useState<Encounter[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await opdApi.queue(t, providerId ? { providerId } : {}));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, providerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const waiting = (rows ?? []).filter((e) => e.status === 'CHECKED_IN');
    const inConsult = (rows ?? []).filter((e) => e.status === 'IN_PROGRESS');
    const completed = (rows ?? []).filter((e) => e.status === 'COMPLETED');
    return { waiting, inConsult, completed };
  }, [rows]);

  async function start(id: string) {
    setBusyId(id);
    try {
      await opdApi.start(t, id);
      router.push(`/doctor/consult/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Doctor"
        subtitle={providerId ? 'Your consultation queue today' : 'Consultation queue today'}
        action={
          <Button variant="ghost" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        }
      />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading your queue…" />}

      {rows && (
        <>
          <div className="mb-6 space-y-6">
            <HelpTip title="Doctor flow">
              Open in-progress consultations first, then longest-waiting checked-in patients. Lab/IPD items appear here
              when a result, round, or inpatient action needs your attention.
            </HelpTip>
            <WorkQueuePanel
              title="Clinical work queue"
              modules={['OPD', 'SCHEDULING', 'LAB', 'IPD']}
              limit={6}
              compact
            />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Waiting" value={groups.waiting.length} />
            <StatCard label="In consult" value={groups.inConsult.length} />
            <StatCard label="Completed today" value={groups.completed.length} />
          </div>

          {groups.inConsult.length > 0 && (
            <Section title="In consultation" className="mb-6">
              <ul className="divide-y divide-line">
                {groups.inConsult.map((e) => (
                  <li key={e.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="font-medium text-ink">
                        #{e.tokenNumber} · {e.patient?.fullName}
                      </div>
                      <div className="text-label-sm text-ink-soft">{e.chiefComplaint || 'Consultation'}</div>
                    </div>
                    <Link href={`/doctor/consult/${e.id}`}>
                      <Button size="sm">Open</Button>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Assigned queue">
            {groups.waiting.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  icon={Stethoscope}
                  title="No patients waiting"
                  hint="Checked-in patients assigned to you appear here."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {groups.waiting.map((e) => (
                  <li key={e.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="font-medium text-ink">
                        #{e.tokenNumber} · {e.patient?.fullName}{' '}
                        <span className="text-label-sm text-ink-soft">
                          ({ageFromDob(e.patient?.dob)}/{e.patient?.sex?.[0] ?? '—'})
                        </span>
                      </div>
                      <div className="text-label-sm text-ink-soft">{e.chiefComplaint || 'Consultation'}</div>
                    </div>
                    <Button size="sm" icon={Stethoscope} loading={busyId === e.id} onClick={() => start(e.id)}>
                      Start
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {groups.completed.length > 0 && (
            <Section title="Completed today" className="mt-6">
              <ul className="divide-y divide-line">
                {groups.completed.map((e) => (
                  <li key={e.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-ink">
                      #{e.tokenNumber} · {e.patient?.fullName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-label-sm text-success-fg">
                      <CheckCircle2 className="h-3.5 w-3.5" /> <StatusChip status={e.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}

export default function DoctorPage() {
  return (
    <Protected requireModule="OPD" allowedRoles={['DOCTOR', 'HOSPITAL_ADMIN']}>
      <DoctorInner />
    </Protected>
  );
}
