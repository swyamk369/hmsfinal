'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BedDouble, ClipboardList, HeartPulse, NotebookPen, Pill, type LucideIcon } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { nursingApi, type NursingDashboard } from '@/lib/nursing';
import { ageFromDob, formatDateTime } from '@/lib/format';
import { Badge, EmptyState, ErrorState, PageHeader, Section, Spinner, StatCard, StatusChip } from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

function NursingDashboardInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [dashboard, setDashboard] = useState<NursingDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setDashboard(await nursingApi.dashboard(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!dashboard) return <Spinner label="Loading nursing dashboard..." />;

  const vitalsDue = dashboard.counts.vitalsDue ?? dashboard.counts.admitted;

  return (
    <>
      <PageHeader title="Nursing" subtitle="Assigned inpatients, vitals, MAR, notes, and ward alerts" />

      <div className="mb-6 space-y-6">
        <HelpTip title="Nursing flow">
          Review alerts and missed medication items first, then record due vitals and notes from each admission card.
          The patient care page keeps vitals, notes, MAR, and the timeline together.
        </HelpTip>
        <WorkQueuePanel title="Nursing work queue" modules={['IPD']} limit={6} compact />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Assigned patients" value={dashboard.counts.admitted} icon={BedDouble} />
        <StatCard label="Vitals due" value={vitalsDue} hint={`${dashboard.counts.vitalsToday ?? 0} recorded today`} icon={HeartPulse} />
        <StatCard label="Medications today" value={dashboard.counts.medsToday} icon={Pill} />
        <StatCard label="Notes today" value={dashboard.counts.notesToday} icon={NotebookPen} />
        <StatCard label="Alerts" value={dashboard.counts.alerts} hint="Allergy or risk flags" icon={AlertTriangle} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section title="Admitted patients" className="xl:col-span-2">
          {dashboard.admissions.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={ClipboardList} title="No admitted patients" hint="Active IPD admissions will appear here for nursing care." />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {dashboard.admissions.map((a) => (
                <Link key={a.id} href={`/nursing/ipd/${a.id}`} className="grid gap-3 px-5 py-4 hover:bg-canvas md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{a.patient?.fullName ?? 'Unknown patient'}</span>
                      {a.allergyCount > 0 && <Badge tone="danger">{a.allergyCount} allergy alert{a.allergyCount > 1 ? 's' : ''}</Badge>}
                    </div>
                    <div className="mt-1 text-label-sm text-ink-soft">
                      {a.patient?.mrn ?? '-'} - {ageFromDob(a.patient?.dob)} - {a.patient?.sex ?? '-'}
                    </div>
                  </div>
                  <div className="text-body-sm text-ink-muted">
                    <div>{a.bed?.ward?.name ?? 'Ward'} / {a.bed?.bedNumber ?? 'Bed'}</div>
                    <div>Admitted {formatDateTime(a.admittedAt)}</div>
                  </div>
                  <StatusChip status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </Section>

        <div className="space-y-6">
          <Section title="Care queues">
            <div className="space-y-3 p-5">
              <QueueRow icon={HeartPulse} label="Vitals due" value={vitalsDue} />
              <QueueRow icon={Pill} label="Medications recorded today" value={dashboard.counts.medsToday} />
              <QueueRow icon={NotebookPen} label="Nursing notes today" value={dashboard.counts.notesToday} />
            </div>
          </Section>

          <Section title="Alerts">
            {dashboard.counts.alerts === 0 ? (
              <p className="px-5 py-6 text-body-sm text-ink-muted">No current allergy alerts across admitted patients.</p>
            ) : (
              <div className="divide-y divide-line">
                {dashboard.admissions.filter((a) => a.allergyCount > 0).map((a) => (
                  <Link key={a.id} href={`/nursing/ipd/${a.id}`} className="block px-5 py-3 hover:bg-canvas">
                    <div className="font-medium text-ink">{a.patient?.fullName}</div>
                    <div className="text-label-sm text-danger">{a.allergyCount} recorded allergy alert{a.allergyCount > 1 ? 's' : ''}</div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function QueueRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line bg-canvas px-3 py-2 text-body-sm">
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

export default function NursingPage() {
  return (
    <Protected requireModule="IPD" allowedRoles={['NURSE', 'HOSPITAL_ADMIN']} requirePermission={['nursing.read']}>
      <NursingDashboardInner />
    </Protected>
  );
}
