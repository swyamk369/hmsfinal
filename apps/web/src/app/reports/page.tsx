'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Banknote, ClipboardList, FlaskConical, Warehouse } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { reportsApi, type DashboardReport } from '@/lib/reports';
import { formatDateTime } from '@/lib/format';
import { ErrorState, PageHeader, Spinner } from '@/components/ui';
import { ModuleCard } from './report-ui';

function ReportsLanding() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const membership = getActiveMembership(profile, activeTenantId);
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

  const cards = useMemo(() => {
    const perms = new Set(membership?.permissions ?? []);
    const modules = new Set(membership?.modules ?? []);
    return [
      {
        show: perms.has('reports.operational.read') || perms.has('reports.read'),
        title: 'Operations',
        value: data?.opd?.todayEncounters ?? 0,
        hint: 'Registrations, appointments, OPD, lab, pharmacy, IPD',
        href: '/reports/operations',
        badge: 'OPS',
        icon: Activity,
      },
      {
        show: perms.has('reports.financial.read') || perms.has('bill.read'),
        title: 'Financial',
        value: data?.billing ? 'Ready' : 'No access',
        hint: 'Billing, payments, refunds, receivables, insurance',
        href: '/reports/financial',
        badge: 'FIN',
        icon: Banknote,
      },
      {
        show:
          modules.has('INVENTORY') &&
          (perms.has('reports.inventory.read') || perms.has('inventory.reports.read') || perms.has('inventory.read')),
        title: 'Inventory',
        value: data?.inventory?.lowStock ?? 0,
        hint: 'Stock value, low stock, expiry, POs, ledger',
        href: '/reports/inventory',
        badge: 'INV',
        icon: Warehouse,
      },
      {
        show: perms.has('reports.clinical.read') || perms.has('encounter.read') || perms.has('lab.read'),
        title: 'Clinical',
        value: data?.opd?.completed ?? 0,
        hint: 'Consultations, diagnoses, vitals, prescriptions, labs',
        href: '/reports/clinical',
        badge: 'CLIN',
        icon: FlaskConical,
      },
    ].filter((c) => c.show);
  }, [data, membership]);

  if (err) return <ErrorState message={err} />;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={
          data
            ? `Export-ready reports · updated ${formatDateTime(data.generatedAt)}`
            : 'Export-ready operational reports'
        }
      />
      {!data ? (
        <Spinner label="Loading report categories..." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <ModuleCard
              key={card.href}
              title={card.title}
              value={card.value}
              hint={card.hint}
              href={card.href}
              badge={card.badge}
            />
          ))}
          {cards.length === 0 && (
            <ModuleCard
              title="No report access"
              value={<ClipboardList className="h-6 w-6" />}
              href="/dashboard"
              hint="Ask an administrator for report permissions."
            />
          )}
        </div>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <Protected
      requireModule="REPORTS"
      allowedRoles={[
        'HOSPITAL_ADMIN',
        'HOSPITAL_MANAGER',
        'ACCOUNTANT',
        'BILLING',
        'INVENTORY_MGR',
        'DOCTOR',
        'LAB_TECH',
      ]}
      requirePermission={[
        'reports.read',
        'reports.operational.read',
        'reports.financial.read',
        'reports.inventory.read',
        'reports.clinical.read',
        'bill.read',
        'inventory.read',
        'lab.read',
        'encounter.read',
      ]}
    >
      <ReportsLanding />
    </Protected>
  );
}
