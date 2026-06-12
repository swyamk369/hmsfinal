'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Banknote, BedDouble, FlaskConical, ShieldCheck, Stethoscope, Warehouse } from 'lucide-react';
import Protected from '@/components/Protected';
import { reportsApi, type DashboardReport } from '@/lib/reports';
import { useAuth } from '@/lib/auth-context';
import { money, formatDateTime } from '@/lib/format';
import { Button, EmptyState, ErrorState, PageHeader, Section, Spinner } from '@/components/ui';
import { KpiGrid, ModuleCard } from '@/app/reports/report-ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

function ManagerInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [data, setData] = useState<DashboardReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await reportsApi.manager(t));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState message={err} />;
  if (!data) return <Spinner label="Loading operations command center..." />;

  return (
    <>
      <PageHeader
        title="Operations"
        subtitle={`Hospital command center · updated ${formatDateTime(data.generatedAt)}`}
        action={
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        <HelpTip title="Manager focus">
          Start with blockers, then scan module pressure. The queue only shows work from modules enabled for this
          hospital and actions your account can open.
        </HelpTip>

        <KpiGrid
          items={[
            {
              label: 'OPD volume',
              value: data.opd?.todayEncounters ?? 0,
              hint: `${data.opd?.completionRate ?? 0}% completion`,
              icon: Stethoscope,
            },
            {
              label: 'Revenue today',
              value: money(data.billing?.paidToday ?? 0),
              hint: `${money(data.billing?.outstandingReceivables ?? 0)} outstanding`,
              icon: Banknote,
            },
            {
              label: 'IPD occupancy',
              value: `${data.ipd?.occupancyRate ?? 0}%`,
              hint: `${data.ipd?.activeAdmissions ?? 0} active admissions`,
              icon: BedDouble,
            },
            { label: 'Open alerts', value: data.alerts.length, hint: 'Cross-module bottlenecks', icon: Activity },
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.lab && (
            <ModuleCard
              title="Lab pressure"
              value={data.lab.ordered + data.lab.processing}
              hint={`${data.lab.abnormalUnverified} abnormal pending`}
              href="/lab"
              badge="LAB"
            />
          )}
          {data.pharmacy && (
            <ModuleCard
              title="Pharmacy queue"
              value={data.pharmacy.pendingPrescriptions}
              hint={`${data.pharmacy.dispensedToday} dispensed today`}
              href="/pharmacy"
              badge="PHARMACY"
            />
          )}
          {data.inventory && (
            <ModuleCard
              title="Inventory risk"
              value={data.inventory.lowStock}
              hint={`${data.inventory.pendingPurchases} pending POs`}
              href="/inventory"
              badge="INVENTORY"
            />
          )}
          {data.insurance && (
            <ModuleCard
              title="Insurance receivables"
              value={money(data.insurance.approvedOutstanding)}
              hint={`${data.insurance.settledToday ? money(data.insurance.settledToday) : money(0)} settled today`}
              href="/insurance"
              badge="INSURANCE"
            />
          )}
        </div>

        <Section title="Operational alerts">
          {data.alerts.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No active bottlenecks"
                hint="Alerts appear when live module data crosses an operational threshold."
              />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {data.alerts.map((alert) => (
                <Link
                  key={alert.label}
                  href={alert.href}
                  className="flex items-center justify-between px-5 py-3 hover:bg-canvas"
                >
                  <span className="font-medium text-ink">{alert.label}</span>
                  <span className="text-body-sm text-primary">Open</span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <WorkQueuePanel
          title="Cross-department work queue"
          modules={[
            'OPD',
            'SCHEDULING',
            'LAB',
            'PHARMACY',
            'INVENTORY',
            'BILLING',
            'IPD',
            'INSURANCE',
            'ADMIN',
            'SYSTEM',
          ]}
          limit={12}
        />

        <Section title="Report shortcuts">
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            <Link href="/reports/operations">
              <Button variant="ghost">Operations report</Button>
            </Link>
            <Link href="/reports/financial">
              <Button variant="ghost">Financial report</Button>
            </Link>
            <Link href="/reports/inventory">
              <Button variant="ghost" icon={Warehouse}>
                Inventory report
              </Button>
            </Link>
            <Link href="/reports/clinical">
              <Button variant="ghost" icon={FlaskConical}>
                Clinical report
              </Button>
            </Link>
          </div>
        </Section>
      </div>
    </>
  );
}

export default function ManagerPage() {
  return (
    <Protected
      requireModule="REPORTS"
      allowedRoles={['HOSPITAL_MANAGER', 'HOSPITAL_ADMIN']}
      requirePermission={['reports.read', 'reports.operational.read']}
    >
      <ManagerInner />
    </Protected>
  );
}
