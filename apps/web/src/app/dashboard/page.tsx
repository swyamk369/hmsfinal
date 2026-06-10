'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Banknote,
  BedDouble,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  Warehouse,
} from 'lucide-react';
import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { reportsApi, type DashboardReport } from '@/lib/reports';
import { money, formatDateTime } from '@/lib/format';
import { Button, EmptyState, ErrorState, Section, Spinner, Badge } from '@/components/ui';
import { KpiGrid, ModuleCard } from '@/app/reports/report-ui';

function DashboardInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const membership = getActiveMembership(profile, activeTenantId);
  const roles = new Set(membership?.roles ?? []);
  const modules = new Set(membership?.modules ?? []);
  const [data, setData] = useState<DashboardReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await reportsApi.dashboard(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleLabel = useMemo(() => {
    if (roles.has('HOSPITAL_ADMIN')) return 'Hospital administration';
    if (roles.has('HOSPITAL_MANAGER')) return 'Operations command';
    if (roles.has('RECEPTION')) return 'Reception desk';
    if (roles.has('DOCTOR')) return 'Doctor workspace';
    if (roles.has('NURSE')) return 'Nursing care';
    if (roles.has('LAB_TECH')) return 'Laboratory queue';
    if (roles.has('PHARMACIST')) return 'Pharmacy queue';
    if (roles.has('INVENTORY_MGR')) return 'Inventory control';
    if (roles.has('ACCOUNTANT')) return 'Accounts receivable';
    if (roles.has('BILLING')) return 'Billing desk';
    if (roles.has('INSURANCE_STAFF')) return 'Insurance desk';
    return 'Workspace';
  }, [roles]);

  if (err) return <ErrorState message={err} />;

  return (
    <RoleHome title="Dashboard" subtitle={`${roleLabel} · live tenant workspace`}>
      {!data ? (
        <Spinner label="Loading live dashboard..." />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-body-sm text-ink-soft">Updated {formatDateTime(data.generatedAt)}</div>
            <Button variant="ghost" onClick={load}>
              Refresh
            </Button>
          </div>

          <KpiGrid
            items={[
              data.setup && { label: 'Patients', value: data.setup.patients, hint: `${data.setup.activeStaff} active staff`, icon: Users },
              data.opd && { label: 'OPD today', value: data.opd.todayEncounters, hint: `${data.opd.queueWaiting} waiting`, icon: Stethoscope },
              data.billing && { label: 'Collected today', value: money(data.billing.paidToday), hint: `${money(data.billing.outstandingReceivables)} outstanding`, icon: Banknote },
              data.ipd && { label: 'IPD occupancy', value: `${data.ipd.occupancyRate}%`, hint: `${data.ipd.occupiedBeds}/${data.ipd.totalBeds} beds`, icon: BedDouble },
            ].filter(Boolean) as any}
          />

          {data.alerts.length > 0 ? (
            <Section title="Operational alerts">
              <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                {data.alerts.map((alert) => (
                  <Link key={alert.label} href={alert.href} className="rounded-md border border-line bg-canvas px-3 py-2 hover:border-primary/50">
                    <div className="flex items-center gap-2 text-body-sm font-medium text-ink">
                      <AlertTriangle className="h-4 w-4 text-warning-fg" /> {alert.label}
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          ) : (
            <EmptyState title="No critical alerts" hint="Live module alerts appear here when something needs attention." />
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.opd && <ModuleCard title="OPD queue" value={data.opd.queueWaiting} hint={`${data.opd.completed} completed today`} href={roles.has('DOCTOR') ? '/doctor' : '/opd'} badge="OPD" />}
            {data.lab && <ModuleCard title="Lab pending" value={data.lab.ordered + data.lab.sampleCollected + data.lab.processing} hint={`${data.lab.abnormalUnverified} abnormal unverified`} href="/lab" badge="LAB" />}
            {data.pharmacy && <ModuleCard title="Pharmacy pending" value={data.pharmacy.pendingPrescriptions} hint={`${data.pharmacy.dispensedToday} dispensed today`} href="/pharmacy" badge="PHARMACY" />}
            {data.inventory && <ModuleCard title="Inventory risk" value={data.inventory.lowStock} hint={`${data.inventory.expiringBatches} batches expiring`} href="/inventory" badge="INVENTORY" />}
            {data.nursing && <ModuleCard title="Nursing tasks" value={data.nursing.vitalsDue} hint={`${data.nursing.medsToday} meds today`} href="/nursing" badge="NURSING" />}
            {data.insurance && <ModuleCard title="Insurance receivables" value={money(data.insurance.approvedOutstanding)} hint={`${data.insurance.submitted + data.insurance.underReview} open submissions`} href="/insurance" badge="INSURANCE" />}
            {data.billing && <ModuleCard title="Billing receivables" value={money(data.billing.outstandingReceivables)} hint={`${data.billing.unpaidBills} unpaid bills`} href="/billing" badge="BILLING" />}
            {modules.has('REPORTS') && <ModuleCard title="Reports" value="Open" hint="Operations, financial, inventory, clinical" href="/reports" badge="REPORTS" />}
          </div>

          <Section title="Quick actions">
            <div className="flex flex-wrap gap-2 p-5">
              {modules.has('PATIENT') && (
                <Link href="/patients?new=1">
                  <Button variant="ghost" icon={Users}>Register patient</Button>
                </Link>
              )}
              {modules.has('OPD') && (
                <Link href="/reception">
                  <Button variant="ghost" icon={ClipboardList}>Check-in</Button>
                </Link>
              )}
              {roles.has('DOCTOR') && (
                <Link href="/doctor">
                  <Button variant="ghost" icon={Stethoscope}>Open queue</Button>
                </Link>
              )}
              {modules.has('IPD') && (
                <Link href="/ipd">
                  <Button variant="ghost" icon={BedDouble}>IPD beds</Button>
                </Link>
              )}
              {modules.has('LAB') && (
                <Link href="/lab">
                  <Button variant="ghost" icon={FlaskConical}>Lab queue</Button>
                </Link>
              )}
              {modules.has('PHARMACY') && (
                <Link href="/pharmacy">
                  <Button variant="ghost" icon={Pill}>Pharmacy</Button>
                </Link>
              )}
              {modules.has('INVENTORY') && (
                <Link href="/inventory">
                  <Button variant="ghost" icon={Warehouse}>Inventory</Button>
                </Link>
              )}
              {modules.has('INSURANCE') && (
                <Link href="/insurance">
                  <Button variant="ghost" icon={ShieldCheck}>Claims</Button>
                </Link>
              )}
            </div>
          </Section>
        </div>
      )}
    </RoleHome>
  );
}

export default function DashboardPage() {
  return (
    <Protected>
      <DashboardInner />
    </Protected>
  );
}
