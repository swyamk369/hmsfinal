'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BedDouble,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  FlaskConical,
  Gauge,
  HeartPulse,
  Pill,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { MODULE_LABELS } from '@/lib/constants';
import { reportsApi, type DashboardReport } from '@/lib/reports';
import { money, formatDateTime } from '@/lib/format';
import { Button, EmptyState, ErrorState, PageHeader, Section, Spinner, Badge, cx } from '@/components/ui';
import { KpiGrid } from '@/app/reports/report-ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

const MODULE_ROUTES: Record<string, string> = {
  ADMIN: '/admin',
  PATIENT: '/patients',
  OPD: '/opd',
  SCHEDULING: '/opd/appointments',
  BILLING: '/finance',
  LAB: '/lab',
  PHARMACY: '/pharmacy',
  INVENTORY: '/inventory',
  IPD: '/ipd',
  INSURANCE: '/insurance',
  REPORTS: '/reports',
};

type KpiItem = { label: string; value: ReactNode; hint?: string; icon?: LucideIcon };
type HealthTone = 'primary' | 'success' | 'warning' | 'danger' | 'slate';
type DashboardKind =
  | 'admin'
  | 'manager'
  | 'reception'
  | 'doctor'
  | 'nurse'
  | 'lab'
  | 'pharmacy'
  | 'inventory'
  | 'finance'
  | 'insurance'
  | 'workspace';

type DashboardView = {
  kind: DashboardKind;
  title: string;
  subtitle: string;
  helpTitle: string;
  help: string;
  queueTitle: string;
  queueModules: string[];
  primaryHref?: string;
  primaryLabel?: string;
  primaryIcon?: LucideIcon;
};

function DashboardInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const membership = getActiveMembership(profile, activeTenantId);
  const roles = useMemo(() => new Set(membership?.roles ?? []), [membership?.roles]);
  const modules = useMemo(() => new Set(membership?.modules ?? []), [membership?.modules]);
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

  const view = useMemo(() => dashboardViewFor(roles), [roles]);

  if (err) return <ErrorState message={err} />;

  return (
    <>
      {!data ? (
        <>
          <PageHeader title={view.title} subtitle={`${membership?.tenantName ?? 'Hospital'} · ${view.subtitle}`} />
          <Spinner label="Loading live dashboard..." />
        </>
      ) : roles.has('HOSPITAL_ADMIN') ? (
        <HospitalAdminDashboard
          data={data}
          modules={modules}
          load={load}
          tenantName={membership?.tenantName ?? 'Hospital'}
        />
      ) : (
        <RoleWorkspaceDashboard
          data={data}
          modules={modules}
          roles={roles}
          load={load}
          tenantName={membership?.tenantName ?? 'Hospital'}
          view={view}
        />
      )}
    </>
  );
}

function HospitalAdminDashboard({
  data,
  modules,
  load,
  tenantName,
}: {
  data: DashboardReport;
  modules: Set<string>;
  load: () => Promise<void>;
  tenantName: string;
}) {
  const setupItems = [
    { label: 'Facilities', value: data.setup?.facilities ?? 0, href: '/admin/facilities' },
    { label: 'Departments', value: data.setup?.departments ?? 0, href: '/admin/departments' },
    { label: 'Active staff', value: data.setup?.activeStaff ?? 0, href: '/admin/staff' },
    { label: 'Service catalog', value: data.setup?.serviceCatalogItems ?? 0, href: '/admin/catalog' },
  ];
  const setupDone = setupItems.filter((item) => Number(item.value) > 0).length;
  const setupScore = Math.round((setupDone / setupItems.length) * 100);
  const occupancy = data.ipd?.occupancyRate ?? 0;
  const queuePressure = data.opd ? data.opd.queueWaiting + data.opd.inProgress : 0;
  const revenueTarget = Math.max(data.billing?.billedToday ?? 0, data.billing?.paidToday ?? 0, 1);
  const collectionRate = data.billing ? Math.round(((data.billing.paidToday ?? 0) / revenueTarget) * 100) : 0;
  const riskCount =
    (data.alerts.length ?? 0) +
    (data.nursing?.vitalsDue ? 1 : 0) +
    (setupScore < 100 ? 1 : 0) +
    (queuePressure > 0 ? 1 : 0);

  const kpis: KpiItem[] = [
    {
      label: 'Patients',
      value: data.setup?.patients ?? 0,
      hint: `${data.setup?.activeStaff ?? 0} active staff`,
      icon: Users,
    },
    {
      label: 'OPD flow today',
      value: data.opd?.todayEncounters ?? 0,
      hint: `${data.opd?.queueWaiting ?? 0} waiting · ${data.opd?.completionRate ?? 0}% complete`,
      icon: Stethoscope,
    },
    {
      label: 'Cash collected',
      value: money(data.billing?.paidToday ?? 0),
      hint: `${money(data.billing?.outstandingReceivables ?? 0)} receivable`,
      icon: Banknote,
    },
    {
      label: 'Admin attention',
      value: riskCount,
      hint: 'Alerts, queue pressure, setup, care tasks',
      icon: Gauge,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Command Center"
        subtitle={`${tenantName} · hospital operations, access, setup, and risk`}
        action={
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center px-1 text-body-sm text-ink-soft">
              Updated {formatDateTime(data.generatedAt)}
            </span>
            {modules.has('REPORTS') && (
              <Link href="/manager">
                <Button variant="ghost" icon={Activity}>
                  Manager view
                </Button>
              </Link>
            )}
            <Button variant="ghost" onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="primary">Admin</Badge>
          <Badge tone="slate">{modules.size} modules enabled</Badge>
          {data.alerts.length > 0 ? (
            <Badge tone="warning">{data.alerts.length} alerts</Badge>
          ) : (
            <Badge tone="success">No alerts</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {modules.has('REPORTS') && (
            <Link href="/reports">
              <Button variant="ghost" icon={FileText}>
                Reports
              </Button>
            </Link>
          )}
        </div>
      </div>

      <HelpTip title="Admin focus">
        This dashboard shows what a hospital admin should watch first: patient flow, money collection, bed capacity,
        stock risk, lab risk, insurance receivables, setup readiness, and access control.
      </HelpTip>

      <KpiGrid items={kpis} />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.45fr]">
        <Section title="Hospital health">
          <div className="grid gap-5 p-5 md:grid-cols-[180px_1fr]">
            <ProgressDial value={setupScore} label="Setup ready" href="/admin" linkLabel="Review setup" />
            <div className="space-y-4">
              <HealthMeter
                label="OPD pressure"
                value={data.opd?.todayEncounters ?? 0}
                max={Math.max(data.opd?.todayEncounters ?? 0, data.opd?.queueWaiting ?? 0, 1)}
                hint={`${data.opd?.queueWaiting ?? 0} waiting, ${data.opd?.inProgress ?? 0} in progress`}
                tone={(data.opd?.queueWaiting ?? 0) > 5 ? 'warning' : 'primary'}
              />
              <HealthMeter
                label="Collection rate"
                value={collectionRate}
                max={100}
                suffix="%"
                hint={`${money(data.billing?.paidToday ?? 0)} collected from ${money(data.billing?.billedToday ?? 0)} billed today`}
                tone={collectionRate >= 80 ? 'success' : collectionRate >= 50 ? 'warning' : 'danger'}
              />
              <HealthMeter
                label="IPD occupancy"
                value={occupancy}
                max={100}
                suffix="%"
                hint={`${data.ipd?.occupiedBeds ?? 0}/${data.ipd?.totalBeds ?? 0} beds occupied`}
                tone={occupancy >= 85 ? 'danger' : occupancy >= 70 ? 'warning' : 'success'}
              />
              <HealthMeter
                label="Inventory risk"
                value={(data.inventory?.lowStock ?? 0) + (data.inventory?.expiringBatches ?? 0)}
                max={Math.max((data.inventory?.itemCount ?? 0) || 1, 1)}
                hint={`${data.inventory?.lowStock ?? 0} low stock, ${data.inventory?.expiringBatches ?? 0} expiring batches`}
                tone={(data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success'}
              />
            </div>
          </div>
        </Section>

        <Section title="Admin watchlist">
          <div className="divide-y divide-line">
            <WatchRow
              icon={ClipboardList}
              title="OPD and reception flow"
              body={`${data.opd?.queueWaiting ?? 0} waiting, ${data.opd?.inProgress ?? 0} in consultation, ${data.opd?.completed ?? 0} completed today`}
              href="/opd"
              tone={(data.opd?.queueWaiting ?? 0) > 0 ? 'warning' : 'success'}
            />
            <WatchRow
              icon={Banknote}
              title="Finance and receivables"
              body={`${money(data.billing?.outstandingReceivables ?? 0)} outstanding across ${data.billing?.unpaidBills ?? 0} unpaid bills`}
              href="/finance"
              tone={(data.billing?.outstandingReceivables ?? 0) > 0 ? 'warning' : 'success'}
            />
            <WatchRow
              icon={FlaskConical}
              title="Clinical risk"
              body={`${data.lab?.abnormalUnverified ?? 0} abnormal lab results need verification, ${data.nursing?.vitalsDue ?? 0} admitted patients need vitals`}
              href={(data.lab?.abnormalUnverified ?? 0) > 0 ? '/lab' : '/nursing'}
              tone={(data.lab?.abnormalUnverified ?? 0) + (data.nursing?.vitalsDue ?? 0) > 0 ? 'danger' : 'success'}
            />
            <WatchRow
              icon={Warehouse}
              title="Stock and procurement"
              body={`${data.inventory?.lowStock ?? 0} low-stock items, ${data.inventory?.pendingPurchases ?? 0} purchase orders pending`}
              href="/inventory"
              tone={(data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success'}
            />
            <WatchRow
              icon={Settings2}
              title="Setup and permissions"
              body={`${setupDone}/${setupItems.length} setup areas ready. Review staff roles and per-hospital access patterns from Admin Roles.`}
              href="/admin/roles"
              tone={setupScore === 100 ? 'success' : 'warning'}
            />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Section title="Department pressure">
          <div className="grid gap-3 p-5 md:grid-cols-2">
            <AdminModuleCard
              title="Reception and OPD"
              value={data.opd?.todayEncounters ?? 0}
              hint={`${data.opd?.todayAppointments ?? 0} appointments · ${data.opd?.walkIns ?? 0} walk-ins`}
              href="/reception"
              icon={CalendarClock}
              tone={(data.opd?.queueWaiting ?? 0) > 0 ? 'warning' : 'primary'}
            />
            <AdminModuleCard
              title="Lab"
              value={(data.lab?.ordered ?? 0) + (data.lab?.sampleCollected ?? 0) + (data.lab?.processing ?? 0)}
              hint={`${data.lab?.completedToday ?? 0} completed today · ${data.lab?.abnormalUnverified ?? 0} abnormal`}
              href="/lab"
              icon={FlaskConical}
              tone={(data.lab?.abnormalUnverified ?? 0) > 0 ? 'danger' : 'primary'}
            />
            <AdminModuleCard
              title="Pharmacy"
              value={data.pharmacy?.pendingPrescriptions ?? 0}
              hint={`${data.pharmacy?.dispensedToday ?? 0} dispensed today`}
              href="/pharmacy"
              icon={Pill}
              tone={(data.pharmacy?.pendingPrescriptions ?? 0) > 0 ? 'warning' : 'success'}
            />
            <AdminModuleCard
              title="IPD and nursing"
              value={`${data.ipd?.occupancyRate ?? 0}%`}
              hint={`${data.ipd?.activeAdmissions ?? 0} active admissions · ${data.nursing?.vitalsDue ?? 0} vitals due`}
              href="/ipd"
              icon={BedDouble}
              tone={occupancy >= 85 || (data.nursing?.vitalsDue ?? 0) > 0 ? 'warning' : 'success'}
            />
            <AdminModuleCard
              title="Insurance"
              value={money(data.insurance?.approvedOutstanding ?? 0)}
              hint={`${(data.insurance?.submitted ?? 0) + (data.insurance?.underReview ?? 0)} claims open`}
              href="/insurance"
              icon={ShieldCheck}
              tone={(data.insurance?.approvedOutstanding ?? 0) > 0 ? 'warning' : 'success'}
            />
            <AdminModuleCard
              title="Inventory"
              value={data.inventory?.lowStock ?? 0}
              hint={`${money(data.inventory?.stockValue ?? 0)} stock value`}
              href="/inventory"
              icon={Warehouse}
              tone={(data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success'}
            />
          </div>
        </Section>

        <Section title="Setup readiness">
          <div className="divide-y divide-line">
            {setupItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  {Number(item.value) > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-warning-fg" />
                  )}
                  <div>
                    <div className="font-medium text-ink">{item.label}</div>
                    <div className="text-body-sm text-ink-soft">{item.value} configured</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-ink-soft" />
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Module access map">
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {[...modules].map((module) => (
            <Link
              key={module}
              href={MODULE_ROUTES[module] ?? '/dashboard'}
              className="rounded-md border border-line px-3 py-3 transition hover:border-primary/60 hover:bg-primary-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-label-md uppercase text-ink-muted">{module}</div>
                  <div className="mt-1 text-body-sm font-medium text-ink">{MODULE_LABELS[module] ?? module}</div>
                </div>
                <Badge tone="success">On</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {data.alerts.length > 0 ? (
        <Section title="Operational alerts">
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {data.alerts.map((alert) => (
              <Link
                key={alert.label}
                href={alert.href}
                className="rounded-md border border-line bg-canvas px-3 py-2 transition hover:border-primary/50"
              >
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

      <WorkQueuePanel
        title="Admin action queue"
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

      <Section title="Admin shortcuts">
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Shortcut href="/admin" icon={Settings2} label="Hospital setup" />
          <Shortcut href="/admin/staff" icon={Users} label="Staff directory" />
          <Shortcut href="/admin/roles" icon={ShieldCheck} label="Roles and access" />
          <Shortcut href="/admin/audit" icon={FileText} label="Audit log" />
          <Shortcut href="/reception" icon={ClipboardList} label="Reception desk" />
          <Shortcut href="/finance" icon={Banknote} label="Finance center" />
          <Shortcut href="/reports" icon={Activity} label="Reports" />
          <Shortcut href="/support/workflows" icon={Wrench} label="Workflow help" />
        </div>
      </Section>
    </div>
  );
}

function RoleWorkspaceDashboard({
  data,
  modules,
  roles,
  load,
  tenantName,
  view,
}: {
  data: DashboardReport;
  modules: Set<string>;
  roles: Set<string>;
  load: () => Promise<void>;
  tenantName: string;
  view: DashboardView;
}) {
  const kpis = roleKpis(view.kind, data);
  const meters = roleMeters(view.kind, data);
  const focus = roleFocus(view.kind, data);
  const cards = roleFlowCards(view.kind, data, modules, roles);
  const shortcuts = roleShortcuts(view.kind, modules, roles);
  const score = roleScore(view.kind, data);

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.title}
        subtitle={`${tenantName} · ${view.subtitle}`}
        action={
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center px-1 text-body-sm text-ink-soft">
              Updated {formatDateTime(data.generatedAt)}
            </span>
            {view.primaryHref && (
              <Link href={view.primaryHref}>
                <Button variant="ghost" icon={view.primaryIcon}>
                  {view.primaryLabel}
                </Button>
              </Link>
            )}
            <Button variant="ghost" onClick={load}>
              Refresh
            </Button>
          </div>
        }
      />

      <HelpTip title={view.helpTitle}>{view.help}</HelpTip>

      <KpiGrid items={kpis} />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.45fr]">
        <Section title={`${view.title} pulse`}>
          <div className="grid gap-5 p-5 md:grid-cols-[180px_1fr]">
            <ProgressDial
              value={score}
              label="Today"
              href={view.primaryHref ?? '/dashboard'}
              linkLabel={view.primaryLabel ?? 'Open workspace'}
            />
            <div className="space-y-4">
              {meters.map((meter) => (
                <HealthMeter key={meter.label} {...meter} />
              ))}
            </div>
          </div>
        </Section>

        <Section title="What needs attention">
          <div className="divide-y divide-line">
            {focus.map((item) => (
              <WatchRow key={item.title} {...item} />
            ))}
          </div>
        </Section>
      </div>

      {cards.length > 0 && (
        <Section title="Workflow snapshot">
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <AdminModuleCard key={card.title} {...card} />
            ))}
          </div>
        </Section>
      )}

      <WorkQueuePanel title={view.queueTitle} modules={view.queueModules} limit={10} />

      <Section title="Quick actions">
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((shortcut) => (
            <Shortcut key={shortcut.href + shortcut.label} {...shortcut} />
          ))}
        </div>
      </Section>

      {data.alerts.length > 0 ? (
        <Section title="Cross-module alerts">
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {data.alerts.map((alert) => (
              <Link
                key={alert.label}
                href={alert.href}
                className="rounded-md border border-line bg-canvas px-3 py-2 transition hover:border-primary/50"
              >
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
    </div>
  );
}

type MeterItem = {
  label: string;
  value: number;
  max: number;
  hint: string;
  suffix?: string;
  tone?: HealthTone;
};

type FocusItem = {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  tone: HealthTone;
};

type FlowCard = {
  title: string;
  value: ReactNode;
  hint: string;
  href: string;
  icon: LucideIcon;
  tone: HealthTone;
};

type ShortcutDef = {
  href: string;
  icon: LucideIcon;
  label: string;
};

function dashboardViewFor(roles: Set<string>): DashboardView {
  if (roles.has('HOSPITAL_ADMIN')) {
    return {
      kind: 'admin',
      title: 'Admin Command Center',
      subtitle: 'hospital operations, access, setup, and risk',
      helpTitle: 'Admin focus',
      help: 'Watch patient flow, collection, capacity, stock, clinical risk, setup readiness, and access control before going into deep module work.',
      queueTitle: 'Admin action queue',
      queueModules: [
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
      ],
      primaryHref: '/admin',
      primaryLabel: 'Hospital setup',
      primaryIcon: Settings2,
    };
  }
  if (roles.has('HOSPITAL_MANAGER')) {
    return {
      kind: 'manager',
      title: 'Manager Command Center',
      subtitle: 'cross-department flow, capacity, and bottlenecks',
      helpTitle: 'Manager focus',
      help: 'Start with blockers, then scan department pressure. The charts surface queue, revenue, bed, stock, lab, pharmacy, and insurance pressure without opening every module.',
      queueTitle: 'Cross-department work queue',
      queueModules: [
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
      ],
      primaryHref: '/manager',
      primaryLabel: 'Operations view',
      primaryIcon: Activity,
    };
  }
  if (roles.has('RECEPTION')) {
    return {
      kind: 'reception',
      title: 'Reception Dashboard',
      subtitle: 'appointments, check-ins, queue flow, and billing handoff',
      helpTitle: 'Front desk focus',
      help: 'Keep the queue moving: register patients, confirm appointments, check in walk-ins, route OPD patients, and hand pending charges to finance.',
      queueTitle: 'Reception work queue',
      queueModules: ['OPD', 'SCHEDULING', 'PATIENT', 'BILLING'],
      primaryHref: '/reception',
      primaryLabel: 'Open reception',
      primaryIcon: ClipboardList,
    };
  }
  if (roles.has('DOCTOR')) {
    return {
      kind: 'doctor',
      title: 'Doctor Dashboard',
      subtitle: 'consultation queue, clinical risk, lab follow-up, and IPD visibility',
      helpTitle: 'Doctor focus',
      help: 'Start with waiting consults, then review abnormal lab results and admitted patients needing clinical attention.',
      queueTitle: 'Doctor work queue',
      queueModules: ['OPD', 'LAB', 'IPD'],
      primaryHref: '/doctor',
      primaryLabel: 'Open consult queue',
      primaryIcon: Stethoscope,
    };
  }
  if (roles.has('NURSE')) {
    return {
      kind: 'nurse',
      title: 'Nursing Dashboard',
      subtitle: 'admitted patients, vitals due, MAR, and nursing notes',
      helpTitle: 'Nursing focus',
      help: 'Prioritize vitals due, medication administration, new notes, and active admissions before routine documentation.',
      queueTitle: 'Nursing work queue',
      queueModules: ['IPD'],
      primaryHref: '/nursing',
      primaryLabel: 'Open nursing',
      primaryIcon: HeartPulse,
    };
  }
  if (roles.has('LAB_TECH')) {
    return {
      kind: 'lab',
      title: 'Lab Dashboard',
      subtitle: 'orders, samples, processing, verification, and abnormal flags',
      helpTitle: 'Lab focus',
      help: 'Move orders through sample collection, processing, result entry, verification, and abnormal result escalation.',
      queueTitle: 'Lab work queue',
      queueModules: ['LAB'],
      primaryHref: '/lab',
      primaryLabel: 'Open lab queue',
      primaryIcon: FlaskConical,
    };
  }
  if (roles.has('PHARMACIST')) {
    return {
      kind: 'pharmacy',
      title: 'Pharmacy Dashboard',
      subtitle: 'prescription queue, dispense flow, and stock risk',
      helpTitle: 'Pharmacy focus',
      help: 'Dispense finalized prescriptions, handle partial stock safely, and watch low-stock or expiring inventory before patient wait times climb.',
      queueTitle: 'Pharmacy work queue',
      queueModules: ['PHARMACY', 'INVENTORY'],
      primaryHref: '/pharmacy',
      primaryLabel: 'Open pharmacy',
      primaryIcon: Pill,
    };
  }
  if (roles.has('INVENTORY_MGR')) {
    return {
      kind: 'inventory',
      title: 'Inventory Dashboard',
      subtitle: 'stock health, procurement, batches, expiry, and ledger control',
      helpTitle: 'Inventory focus',
      help: 'Watch low stock, expiring batches, pending purchase orders, and ledger activity before departments run short.',
      queueTitle: 'Inventory work queue',
      queueModules: ['INVENTORY'],
      primaryHref: '/inventory',
      primaryLabel: 'Open inventory',
      primaryIcon: Warehouse,
    };
  }
  if (roles.has('ACCOUNTANT') || roles.has('BILLING')) {
    return {
      kind: 'finance',
      title: 'Finance Dashboard',
      subtitle: 'billing, cashier collections, receivables, refunds, and day close',
      helpTitle: 'Finance focus',
      help: 'Keep collections connected to OPD, lab, pharmacy, IPD, and insurance. Watch receivables, refunds, unpaid bills, and day-close readiness.',
      queueTitle: 'Finance work queue',
      queueModules: ['BILLING', 'INSURANCE'],
      primaryHref: '/finance',
      primaryLabel: 'Open finance',
      primaryIcon: Banknote,
    };
  }
  if (roles.has('INSURANCE_STAFF')) {
    return {
      kind: 'insurance',
      title: 'Insurance Dashboard',
      subtitle: 'claims, approvals, settlements, rejections, and receivables',
      helpTitle: 'Insurance focus',
      help: 'Track claim submissions, review states, approvals, rejections, settlements, and patient-share impact.',
      queueTitle: 'Insurance work queue',
      queueModules: ['INSURANCE', 'BILLING'],
      primaryHref: '/insurance',
      primaryLabel: 'Open insurance',
      primaryIcon: ShieldCheck,
    };
  }
  return {
    kind: 'workspace',
    title: 'Workspace Dashboard',
    subtitle: 'live tenant work queue and module health',
    helpTitle: 'Workspace focus',
    help: 'Use this view to find assigned work, current alerts, and module shortcuts available to your role.',
    queueTitle: 'My work queue',
    queueModules: [
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
    ],
  };
}

function roleKpis(kind: DashboardKind, data: DashboardReport): KpiItem[] {
  const labPending = labPendingCount(data);
  const financeReceivables = data.billing?.outstandingReceivables ?? 0;
  const insuranceOpen = (data.insurance?.submitted ?? 0) + (data.insurance?.underReview ?? 0);

  switch (kind) {
    case 'manager':
      return [
        {
          label: 'OPD volume',
          value: data.opd?.todayEncounters ?? 0,
          hint: `${data.opd?.completionRate ?? 0}% complete`,
          icon: Stethoscope,
        },
        {
          label: 'Revenue today',
          value: money(data.billing?.paidToday ?? 0),
          hint: `${money(financeReceivables)} receivable`,
          icon: Banknote,
        },
        {
          label: 'IPD occupancy',
          value: `${data.ipd?.occupancyRate ?? 0}%`,
          hint: `${data.ipd?.activeAdmissions ?? 0} active admissions`,
          icon: BedDouble,
        },
        { label: 'Open alerts', value: data.alerts.length, hint: 'Cross-module bottlenecks', icon: Activity },
      ];
    case 'reception':
      return [
        {
          label: 'Appointments',
          value: data.opd?.todayAppointments ?? 0,
          hint: 'Scheduled today',
          icon: CalendarClock,
        },
        {
          label: 'Waiting queue',
          value: data.opd?.queueWaiting ?? 0,
          hint: `${data.opd?.inProgress ?? 0} in progress`,
          icon: ClipboardList,
        },
        {
          label: 'Walk-ins',
          value: data.opd?.walkIns ?? 0,
          hint: `${data.opd?.completed ?? 0} completed`,
          icon: Users,
        },
        {
          label: 'Billing handoff',
          value: data.billing?.unpaidBills ?? 0,
          hint: `${money(financeReceivables)} receivable`,
          icon: Banknote,
        },
      ];
    case 'doctor':
      return [
        {
          label: 'Consults today',
          value: data.opd?.todayEncounters ?? 0,
          hint: `${data.opd?.queueWaiting ?? 0} waiting`,
          icon: Stethoscope,
        },
        {
          label: 'Completed',
          value: data.opd?.completed ?? 0,
          hint: `${data.opd?.completionRate ?? 0}% completion`,
          icon: CheckCircle2,
        },
        {
          label: 'Abnormal labs',
          value: data.lab?.abnormalUnverified ?? 0,
          hint: 'Need review or verification',
          icon: FlaskConical,
        },
        {
          label: 'IPD occupancy',
          value: `${data.ipd?.occupancyRate ?? 0}%`,
          hint: `${data.ipd?.activeAdmissions ?? 0} active admissions`,
          icon: BedDouble,
        },
      ];
    case 'nurse':
      return [
        {
          label: 'Vitals due',
          value: data.nursing?.vitalsDue ?? 0,
          hint: 'Admitted patients pending vitals',
          icon: HeartPulse,
        },
        {
          label: 'Meds today',
          value: data.nursing?.medsToday ?? 0,
          hint: 'Medication administration entries',
          icon: Pill,
        },
        {
          label: 'Notes today',
          value: data.nursing?.notesToday ?? 0,
          hint: 'Nursing documentation',
          icon: ClipboardList,
        },
        {
          label: 'Admissions',
          value: data.ipd?.activeAdmissions ?? 0,
          hint: `${data.ipd?.occupancyRate ?? 0}% beds occupied`,
          icon: BedDouble,
        },
      ];
    case 'lab':
      return [
        { label: 'Pending tests', value: labPending, hint: 'Ordered, sample, and processing', icon: FlaskConical },
        {
          label: 'Samples',
          value: data.lab?.sampleCollected ?? 0,
          hint: 'Collected and awaiting processing',
          icon: ClipboardList,
        },
        {
          label: 'Completed today',
          value: data.lab?.completedToday ?? 0,
          hint: 'Reports completed',
          icon: CheckCircle2,
        },
        {
          label: 'Abnormal pending',
          value: data.lab?.abnormalUnverified ?? 0,
          hint: 'Needs verification',
          icon: AlertTriangle,
        },
      ];
    case 'pharmacy':
      return [
        {
          label: 'Pending Rx',
          value: data.pharmacy?.pendingPrescriptions ?? 0,
          hint: 'Finalized prescriptions',
          icon: Pill,
        },
        {
          label: 'Dispensed today',
          value: data.pharmacy?.dispensedToday ?? 0,
          hint: 'Completed dispense records',
          icon: CheckCircle2,
        },
        { label: 'Low stock', value: data.inventory?.lowStock ?? 0, hint: 'Needs replenishment', icon: Warehouse },
        {
          label: 'Expiring batches',
          value: data.inventory?.expiringBatches ?? 0,
          hint: 'Review FEFO risk',
          icon: AlertTriangle,
        },
      ];
    case 'inventory':
      return [
        { label: 'Active items', value: data.inventory?.itemCount ?? 0, hint: 'Item master', icon: Warehouse },
        {
          label: 'Low stock',
          value: data.inventory?.lowStock ?? 0,
          hint: 'Below reorder threshold',
          icon: AlertTriangle,
        },
        {
          label: 'Pending POs',
          value: data.inventory?.pendingPurchases ?? 0,
          hint: 'Procurement follow-up',
          icon: ClipboardList,
        },
        {
          label: 'Stock value',
          value: money(data.inventory?.stockValue ?? 0),
          hint: `${data.inventory?.expiringBatches ?? 0} expiring batches`,
          icon: Banknote,
        },
      ];
    case 'finance':
      return [
        {
          label: 'Collected today',
          value: money(data.billing?.paidToday ?? 0),
          hint: `${money(data.billing?.billedToday ?? 0)} billed`,
          icon: Banknote,
        },
        {
          label: 'Receivables',
          value: money(financeReceivables),
          hint: `${data.billing?.unpaidBills ?? 0} unpaid bills`,
          icon: FileText,
        },
        { label: 'Partial bills', value: data.billing?.partialBills ?? 0, hint: 'Need follow-up', icon: ClipboardList },
        {
          label: 'Refunds today',
          value: money(data.billing?.refundsToday ?? 0),
          hint: 'Monitor leakage',
          icon: AlertTriangle,
        },
      ];
    case 'insurance':
      return [
        {
          label: 'Open claims',
          value: insuranceOpen,
          hint: `${data.insurance?.submitted ?? 0} submitted`,
          icon: ShieldCheck,
        },
        {
          label: 'Approved outstanding',
          value: money(data.insurance?.approvedOutstanding ?? 0),
          hint: 'Awaiting settlement',
          icon: Banknote,
        },
        {
          label: 'Settled today',
          value: money(data.insurance?.settledToday ?? 0),
          hint: 'Closed value today',
          icon: CheckCircle2,
        },
        { label: 'Rejected', value: data.insurance?.rejected ?? 0, hint: 'Reason required', icon: AlertTriangle },
      ];
    default:
      return [
        {
          label: 'Patients',
          value: data.setup?.patients ?? 0,
          hint: `${data.setup?.activeStaff ?? 0} active staff`,
          icon: Users,
        },
        {
          label: 'OPD today',
          value: data.opd?.todayEncounters ?? 0,
          hint: `${data.opd?.queueWaiting ?? 0} waiting`,
          icon: Stethoscope,
        },
        {
          label: 'Collected today',
          value: money(data.billing?.paidToday ?? 0),
          hint: `${money(financeReceivables)} outstanding`,
          icon: Banknote,
        },
        { label: 'Open alerts', value: data.alerts.length, hint: 'Needs attention', icon: Activity },
      ];
  }
}

function roleMeters(kind: DashboardKind, data: DashboardReport): MeterItem[] {
  const collection = collectionRate(data);
  const opdTotal = Math.max(data.opd?.todayEncounters ?? 0, 1);
  const labTotal = Math.max(
    (data.lab?.ordered ?? 0) +
      (data.lab?.sampleCollected ?? 0) +
      (data.lab?.processing ?? 0) +
      (data.lab?.completedToday ?? 0),
    1,
  );
  const rxTotal = Math.max((data.pharmacy?.pendingPrescriptions ?? 0) + (data.pharmacy?.dispensedToday ?? 0), 1);
  const admissionTotal = Math.max(data.ipd?.activeAdmissions ?? data.ipd?.totalBeds ?? 0, 1);
  const inventoryTotal = Math.max(data.inventory?.itemCount ?? 0, 1);
  const claimTotal = Math.max(
    (data.insurance?.submitted ?? 0) +
      (data.insurance?.underReview ?? 0) +
      (data.insurance?.approved ?? 0) +
      (data.insurance?.settled ?? 0) +
      (data.insurance?.rejected ?? 0),
    1,
  );

  switch (kind) {
    case 'reception':
      return [
        {
          label: 'Queue waiting',
          value: data.opd?.queueWaiting ?? 0,
          max: opdTotal,
          hint: `${data.opd?.inProgress ?? 0} already with doctors`,
          tone: (data.opd?.queueWaiting ?? 0) > 5 ? 'warning' : 'primary',
        },
        {
          label: 'Queue completed',
          value: data.opd?.completionRate ?? 0,
          max: 100,
          suffix: '%',
          hint: `${data.opd?.completed ?? 0} consultations completed`,
          tone: 'success',
        },
        {
          label: 'Appointment load',
          value: data.opd?.todayAppointments ?? 0,
          max: Math.max(data.opd?.todayAppointments ?? 0, data.opd?.todayEncounters ?? 0, 1),
          hint: 'Scheduled demand today',
          tone: 'primary',
        },
        {
          label: 'Billing handoff',
          value: data.billing?.unpaidBills ?? 0,
          max: Math.max((data.billing?.unpaidBills ?? 0) + (data.billing?.partialBills ?? 0), 1),
          hint: `${money(data.billing?.outstandingReceivables ?? 0)} still receivable`,
          tone: (data.billing?.unpaidBills ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    case 'doctor':
      return [
        {
          label: 'Consult completion',
          value: data.opd?.completionRate ?? 0,
          max: 100,
          suffix: '%',
          hint: `${data.opd?.completed ?? 0}/${data.opd?.todayEncounters ?? 0} done`,
          tone: 'success',
        },
        {
          label: 'Waiting consults',
          value: data.opd?.queueWaiting ?? 0,
          max: opdTotal,
          hint: 'Patients still waiting',
          tone: (data.opd?.queueWaiting ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Abnormal lab review',
          value: data.lab?.abnormalUnverified ?? 0,
          max: Math.max(data.lab?.abnormalUnverified ?? 0, labTotal),
          hint: 'Results needing clinical attention',
          tone: (data.lab?.abnormalUnverified ?? 0) > 0 ? 'danger' : 'success',
        },
        {
          label: 'IPD bed pressure',
          value: data.ipd?.occupancyRate ?? 0,
          max: 100,
          suffix: '%',
          hint: `${data.ipd?.activeAdmissions ?? 0} active admissions`,
          tone: (data.ipd?.occupancyRate ?? 0) >= 85 ? 'warning' : 'primary',
        },
      ];
    case 'nurse':
      return [
        {
          label: 'Vitals coverage',
          value: Math.max(0, admissionTotal - (data.nursing?.vitalsDue ?? 0)),
          max: admissionTotal,
          hint: `${data.nursing?.vitalsDue ?? 0} patients still due`,
          tone: (data.nursing?.vitalsDue ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Medication activity',
          value: data.nursing?.medsToday ?? 0,
          max: Math.max(data.nursing?.medsToday ?? 0, 1),
          hint: 'Administration entries today',
          tone: 'primary',
        },
        {
          label: 'Notes completed',
          value: data.nursing?.notesToday ?? 0,
          max: Math.max(admissionTotal, data.nursing?.notesToday ?? 0, 1),
          hint: 'Nursing notes today',
          tone: 'primary',
        },
        {
          label: 'Bed occupancy',
          value: data.ipd?.occupancyRate ?? 0,
          max: 100,
          suffix: '%',
          hint: `${data.ipd?.occupiedBeds ?? 0}/${data.ipd?.totalBeds ?? 0} beds occupied`,
          tone: (data.ipd?.occupancyRate ?? 0) >= 85 ? 'warning' : 'success',
        },
      ];
    case 'lab':
      return [
        {
          label: 'Orders waiting',
          value: data.lab?.ordered ?? 0,
          max: labTotal,
          hint: 'Orders not yet sampled',
          tone: (data.lab?.ordered ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Samples collected',
          value: data.lab?.sampleCollected ?? 0,
          max: labTotal,
          hint: 'Ready for processing',
          tone: 'primary',
        },
        {
          label: 'Processing',
          value: data.lab?.processing ?? 0,
          max: labTotal,
          hint: 'Tests in progress',
          tone: 'primary',
        },
        {
          label: 'Abnormal unverified',
          value: data.lab?.abnormalUnverified ?? 0,
          max: Math.max(data.lab?.abnormalUnverified ?? 0, labTotal),
          hint: 'Escalate quickly',
          tone: (data.lab?.abnormalUnverified ?? 0) > 0 ? 'danger' : 'success',
        },
      ];
    case 'pharmacy':
      return [
        {
          label: 'Prescription queue',
          value: data.pharmacy?.pendingPrescriptions ?? 0,
          max: rxTotal,
          hint: 'Finalized prescriptions waiting',
          tone: (data.pharmacy?.pendingPrescriptions ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Dispensed today',
          value: data.pharmacy?.dispensedToday ?? 0,
          max: rxTotal,
          hint: 'Completed dispense flow',
          tone: 'success',
        },
        {
          label: 'Low stock risk',
          value: data.inventory?.lowStock ?? 0,
          max: inventoryTotal,
          hint: 'May block dispense',
          tone: (data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success',
        },
        {
          label: 'Expiry risk',
          value: data.inventory?.expiringBatches ?? 0,
          max: Math.max(data.inventory?.expiringBatches ?? 0, inventoryTotal),
          hint: 'FEFO review needed',
          tone: (data.inventory?.expiringBatches ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    case 'inventory':
      return [
        {
          label: 'Stock health',
          value: inventoryTotal - (data.inventory?.lowStock ?? 0),
          max: inventoryTotal,
          hint: `${data.inventory?.lowStock ?? 0} low-stock items`,
          tone: (data.inventory?.lowStock ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Expiry watch',
          value: data.inventory?.expiringBatches ?? 0,
          max: Math.max(data.inventory?.expiringBatches ?? 0, inventoryTotal),
          hint: 'Batches expiring soon',
          tone: (data.inventory?.expiringBatches ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Procurement pending',
          value: data.inventory?.pendingPurchases ?? 0,
          max: Math.max(data.inventory?.pendingPurchases ?? 0, 1),
          hint: 'Purchase orders to follow',
          tone: (data.inventory?.pendingPurchases ?? 0) > 0 ? 'primary' : 'success',
        },
        {
          label: 'Catalog coverage',
          value: data.inventory?.itemCount ?? 0,
          max: Math.max(data.inventory?.itemCount ?? 0, 1),
          hint: `${money(data.inventory?.stockValue ?? 0)} stock value`,
          tone: 'primary',
        },
      ];
    case 'finance':
      return [
        {
          label: 'Collection rate',
          value: collection,
          max: 100,
          suffix: '%',
          hint: `${money(data.billing?.paidToday ?? 0)} collected`,
          tone: collection >= 80 ? 'success' : collection >= 50 ? 'warning' : 'danger',
        },
        {
          label: 'Unpaid bills',
          value: data.billing?.unpaidBills ?? 0,
          max: Math.max((data.billing?.unpaidBills ?? 0) + (data.billing?.partialBills ?? 0), 1),
          hint: `${money(data.billing?.outstandingReceivables ?? 0)} receivable`,
          tone: (data.billing?.unpaidBills ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Partial bills',
          value: data.billing?.partialBills ?? 0,
          max: Math.max((data.billing?.unpaidBills ?? 0) + (data.billing?.partialBills ?? 0), 1),
          hint: 'Needs settlement follow-up',
          tone: (data.billing?.partialBills ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Refund control',
          value: data.billing?.refundsToday ?? 0,
          max: Math.max(data.billing?.refundsToday ?? 0, data.billing?.paidToday ?? 0, 1),
          hint: money(data.billing?.refundsToday ?? 0),
          tone: (data.billing?.refundsToday ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    case 'insurance':
      return [
        {
          label: 'Submitted claims',
          value: data.insurance?.submitted ?? 0,
          max: claimTotal,
          hint: 'Awaiting review',
          tone: (data.insurance?.submitted ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Under review',
          value: data.insurance?.underReview ?? 0,
          max: claimTotal,
          hint: 'In payer review',
          tone: 'primary',
        },
        {
          label: 'Settled claims',
          value: data.insurance?.settled ?? 0,
          max: claimTotal,
          hint: `${money(data.insurance?.settledToday ?? 0)} settled today`,
          tone: 'success',
        },
        {
          label: 'Approved outstanding',
          value: data.insurance?.approvedOutstanding ?? 0,
          max: Math.max(data.insurance?.approvedOutstanding ?? 0, data.insurance?.settledToday ?? 0, 1),
          hint: 'Settlement still pending',
          tone: (data.insurance?.approvedOutstanding ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    default:
      return [
        {
          label: 'OPD completion',
          value: data.opd?.completionRate ?? 0,
          max: 100,
          suffix: '%',
          hint: `${data.opd?.completed ?? 0} completed today`,
          tone: 'success',
        },
        {
          label: 'Collection rate',
          value: collection,
          max: 100,
          suffix: '%',
          hint: `${money(data.billing?.paidToday ?? 0)} collected`,
          tone: collection >= 80 ? 'success' : 'warning',
        },
        {
          label: 'IPD occupancy',
          value: data.ipd?.occupancyRate ?? 0,
          max: 100,
          suffix: '%',
          hint: `${data.ipd?.occupiedBeds ?? 0}/${data.ipd?.totalBeds ?? 0} beds`,
          tone: (data.ipd?.occupancyRate ?? 0) >= 85 ? 'warning' : 'primary',
        },
        {
          label: 'Inventory risk',
          value: data.inventory?.lowStock ?? 0,
          max: inventoryTotal,
          hint: `${data.inventory?.expiringBatches ?? 0} expiring batches`,
          tone: (data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success',
        },
      ];
  }
}

function roleFocus(kind: DashboardKind, data: DashboardReport): FocusItem[] {
  const commonFinance = `${money(data.billing?.outstandingReceivables ?? 0)} receivable across ${data.billing?.unpaidBills ?? 0} unpaid bills`;
  switch (kind) {
    case 'manager':
      return [
        {
          icon: ClipboardList,
          title: 'Patient flow',
          body: `${data.opd?.queueWaiting ?? 0} waiting, ${data.opd?.inProgress ?? 0} in progress`,
          href: '/opd',
          tone: (data.opd?.queueWaiting ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: Banknote,
          title: 'Money flow',
          body: commonFinance,
          href: '/finance',
          tone: (data.billing?.outstandingReceivables ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: Warehouse,
          title: 'Supply risk',
          body: `${data.inventory?.lowStock ?? 0} low-stock items and ${data.inventory?.expiringBatches ?? 0} expiring batches`,
          href: '/inventory',
          tone: (data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success',
        },
        {
          icon: ShieldCheck,
          title: 'Insurance settlements',
          body: `${money(data.insurance?.approvedOutstanding ?? 0)} approved but unsettled`,
          href: '/insurance',
          tone: (data.insurance?.approvedOutstanding ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    case 'reception':
      return [
        {
          icon: CalendarClock,
          title: 'Appointments to check in',
          body: `${data.opd?.todayAppointments ?? 0} scheduled today and ${data.opd?.walkIns ?? 0} walk-ins`,
          href: '/opd/appointments',
          tone: 'primary',
        },
        {
          icon: ClipboardList,
          title: 'Live OPD queue',
          body: `${data.opd?.queueWaiting ?? 0} waiting and ${data.opd?.inProgress ?? 0} with doctors`,
          href: '/opd',
          tone: (data.opd?.queueWaiting ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: Users,
          title: 'Patient registration',
          body: `${data.setup?.patients ?? 0} total patient records`,
          href: '/patients?new=1',
          tone: 'primary',
        },
        {
          icon: Banknote,
          title: 'Payment handoff',
          body: commonFinance,
          href: '/finance/pending-charges',
          tone: (data.billing?.outstandingReceivables ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    case 'doctor':
      return [
        {
          icon: Stethoscope,
          title: 'Consultation queue',
          body: `${data.opd?.queueWaiting ?? 0} waiting, ${data.opd?.completed ?? 0} completed today`,
          href: '/doctor',
          tone: (data.opd?.queueWaiting ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: FlaskConical,
          title: 'Lab follow-up',
          body: `${data.lab?.abnormalUnverified ?? 0} abnormal results need attention`,
          href: '/lab',
          tone: (data.lab?.abnormalUnverified ?? 0) > 0 ? 'danger' : 'success',
        },
        {
          icon: BedDouble,
          title: 'Admitted patients',
          body: `${data.ipd?.activeAdmissions ?? 0} active admissions at ${data.ipd?.occupancyRate ?? 0}% occupancy`,
          href: '/ipd',
          tone: (data.ipd?.occupancyRate ?? 0) >= 85 ? 'warning' : 'primary',
        },
        {
          icon: FileText,
          title: 'Clinical reports',
          body: 'Open clinical trend reports when follow-up patterns are unclear.',
          href: '/reports/clinical',
          tone: 'primary',
        },
      ];
    case 'nurse':
      return [
        {
          icon: HeartPulse,
          title: 'Vitals due',
          body: `${data.nursing?.vitalsDue ?? 0} admitted patients need vitals`,
          href: '/nursing',
          tone: (data.nursing?.vitalsDue ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: Pill,
          title: 'Medication administration',
          body: `${data.nursing?.medsToday ?? 0} MAR entries today`,
          href: '/nursing',
          tone: 'primary',
        },
        {
          icon: ClipboardList,
          title: 'Nursing documentation',
          body: `${data.nursing?.notesToday ?? 0} notes recorded today`,
          href: '/nursing',
          tone: 'primary',
        },
        {
          icon: BedDouble,
          title: 'Bed pressure',
          body: `${data.ipd?.occupiedBeds ?? 0}/${data.ipd?.totalBeds ?? 0} beds occupied`,
          href: '/ipd',
          tone: (data.ipd?.occupancyRate ?? 0) >= 85 ? 'warning' : 'success',
        },
      ];
    case 'lab':
      return [
        {
          icon: FlaskConical,
          title: 'Orders not sampled',
          body: `${data.lab?.ordered ?? 0} orders waiting for sample collection`,
          href: '/lab',
          tone: (data.lab?.ordered ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: ClipboardList,
          title: 'Samples and processing',
          body: `${data.lab?.sampleCollected ?? 0} samples collected, ${data.lab?.processing ?? 0} processing`,
          href: '/lab',
          tone: 'primary',
        },
        {
          icon: AlertTriangle,
          title: 'Abnormal verification',
          body: `${data.lab?.abnormalUnverified ?? 0} abnormal results unverified`,
          href: '/lab',
          tone: (data.lab?.abnormalUnverified ?? 0) > 0 ? 'danger' : 'success',
        },
        {
          icon: CheckCircle2,
          title: 'Reports completed',
          body: `${data.lab?.completedToday ?? 0} reports completed today`,
          href: '/lab',
          tone: 'success',
        },
      ];
    case 'pharmacy':
      return [
        {
          icon: Pill,
          title: 'Dispense queue',
          body: `${data.pharmacy?.pendingPrescriptions ?? 0} finalized prescriptions waiting`,
          href: '/pharmacy',
          tone: (data.pharmacy?.pendingPrescriptions ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: CheckCircle2,
          title: 'Completed dispenses',
          body: `${data.pharmacy?.dispensedToday ?? 0} dispensed today`,
          href: '/pharmacy',
          tone: 'success',
        },
        {
          icon: Warehouse,
          title: 'Stock blockers',
          body: `${data.inventory?.lowStock ?? 0} low-stock items can block dispense`,
          href: '/inventory',
          tone: (data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success',
        },
        {
          icon: AlertTriangle,
          title: 'Expiry watch',
          body: `${data.inventory?.expiringBatches ?? 0} batches expiring soon`,
          href: '/inventory',
          tone: (data.inventory?.expiringBatches ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    case 'inventory':
      return [
        {
          icon: AlertTriangle,
          title: 'Low stock',
          body: `${data.inventory?.lowStock ?? 0} active items are at or below threshold`,
          href: '/inventory/items',
          tone: (data.inventory?.lowStock ?? 0) > 0 ? 'danger' : 'success',
        },
        {
          icon: CalendarClock,
          title: 'Expiry',
          body: `${data.inventory?.expiringBatches ?? 0} batches need expiry review`,
          href: '/inventory/transactions',
          tone: (data.inventory?.expiringBatches ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: ClipboardList,
          title: 'Purchase orders',
          body: `${data.inventory?.pendingPurchases ?? 0} POs pending`,
          href: '/inventory/purchases',
          tone: 'primary',
        },
        {
          icon: Banknote,
          title: 'Stock value',
          body: `${money(data.inventory?.stockValue ?? 0)} current sale value`,
          href: '/reports/inventory',
          tone: 'primary',
        },
      ];
    case 'finance':
      return [
        {
          icon: Banknote,
          title: 'Collections',
          body: `${money(data.billing?.paidToday ?? 0)} collected from ${money(data.billing?.billedToday ?? 0)} billed today`,
          href: '/finance/cashier',
          tone: collectionRate(data) >= 80 ? 'success' : 'warning',
        },
        {
          icon: FileText,
          title: 'Receivables',
          body: commonFinance,
          href: '/finance/pending-charges',
          tone: (data.billing?.outstandingReceivables ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: AlertTriangle,
          title: 'Refund control',
          body: `${money(data.billing?.refundsToday ?? 0)} refunded today`,
          href: '/finance/refunds',
          tone: (data.billing?.refundsToday ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: ShieldCheck,
          title: 'Insurance receivables',
          body: `${money(data.insurance?.approvedOutstanding ?? 0)} approved but unsettled`,
          href: '/finance/insurance-receivables',
          tone: (data.insurance?.approvedOutstanding ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    case 'insurance':
      return [
        {
          icon: ShieldCheck,
          title: 'Open claims',
          body: `${(data.insurance?.submitted ?? 0) + (data.insurance?.underReview ?? 0)} claims in submission or review`,
          href: '/insurance',
          tone: 'primary',
        },
        {
          icon: Banknote,
          title: 'Pending settlements',
          body: `${money(data.insurance?.approvedOutstanding ?? 0)} approved but unpaid`,
          href: '/insurance',
          tone: (data.insurance?.approvedOutstanding ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          icon: CheckCircle2,
          title: 'Settled today',
          body: `${money(data.insurance?.settledToday ?? 0)} settled today`,
          href: '/accounts',
          tone: 'success',
        },
        {
          icon: AlertTriangle,
          title: 'Rejected claims',
          body: `${data.insurance?.rejected ?? 0} rejected claims need documented follow-up`,
          href: '/insurance',
          tone: (data.insurance?.rejected ?? 0) > 0 ? 'warning' : 'success',
        },
      ];
    default:
      return [
        {
          icon: ClipboardList,
          title: 'Work queue',
          body: 'Open assigned tasks from enabled modules.',
          href: '/dashboard',
          tone: 'primary',
        },
        {
          icon: AlertTriangle,
          title: 'Alerts',
          body: `${data.alerts.length} cross-module alerts`,
          href: '/dashboard',
          tone: data.alerts.length > 0 ? 'warning' : 'success',
        },
        {
          icon: Users,
          title: 'Patient flow',
          body: `${data.opd?.todayEncounters ?? 0} OPD encounters today`,
          href: '/opd',
          tone: 'primary',
        },
        {
          icon: FileText,
          title: 'Reports',
          body: 'Use reports for deeper operational review.',
          href: '/reports',
          tone: 'primary',
        },
      ];
  }
}

function roleFlowCards(
  kind: DashboardKind,
  data: DashboardReport,
  modules: Set<string>,
  roles: Set<string>,
): FlowCard[] {
  const base: FlowCard[] = [];
  const includeOpd = modules.has('OPD') && data.opd;
  const includeBilling = modules.has('BILLING') && data.billing;
  const includeLab = modules.has('LAB') && data.lab;
  const includePharmacy = modules.has('PHARMACY') && data.pharmacy;
  const includeInventory = modules.has('INVENTORY') && data.inventory;
  const includeIpd = modules.has('IPD') && data.ipd;
  const includeInsurance = modules.has('INSURANCE') && data.insurance;

  if (includeOpd && ['manager', 'reception', 'doctor', 'workspace'].includes(kind)) {
    base.push({
      title: 'OPD queue',
      value: data.opd!.queueWaiting,
      hint: `${data.opd!.completed} completed today`,
      href: roles.has('DOCTOR') ? '/doctor' : '/opd',
      icon: Stethoscope,
      tone: data.opd!.queueWaiting > 0 ? 'warning' : 'success',
    });
  }
  if (includeBilling && ['manager', 'reception', 'finance', 'workspace'].includes(kind)) {
    base.push({
      title: 'Finance',
      value: money(data.billing!.outstandingReceivables),
      hint: `${data.billing!.unpaidBills} unpaid bills`,
      href: '/finance',
      icon: Banknote,
      tone: data.billing!.outstandingReceivables > 0 ? 'warning' : 'success',
    });
  }
  if (includeLab && ['manager', 'doctor', 'lab', 'workspace'].includes(kind)) {
    base.push({
      title: 'Lab pending',
      value: labPendingCount(data),
      hint: `${data.lab!.abnormalUnverified} abnormal unverified`,
      href: '/lab',
      icon: FlaskConical,
      tone: data.lab!.abnormalUnverified > 0 ? 'danger' : 'primary',
    });
  }
  if (includePharmacy && ['manager', 'pharmacy', 'workspace'].includes(kind)) {
    base.push({
      title: 'Pharmacy',
      value: data.pharmacy!.pendingPrescriptions,
      hint: `${data.pharmacy!.dispensedToday} dispensed today`,
      href: '/pharmacy',
      icon: Pill,
      tone: data.pharmacy!.pendingPrescriptions > 0 ? 'warning' : 'success',
    });
  }
  if (includeInventory && ['manager', 'pharmacy', 'inventory', 'workspace'].includes(kind)) {
    base.push({
      title: 'Inventory risk',
      value: data.inventory!.lowStock,
      hint: `${data.inventory!.expiringBatches} expiring batches`,
      href: '/inventory',
      icon: Warehouse,
      tone: data.inventory!.lowStock > 0 ? 'danger' : 'success',
    });
  }
  if (includeIpd && ['manager', 'doctor', 'nurse', 'workspace'].includes(kind)) {
    base.push({
      title: 'IPD',
      value: `${data.ipd!.occupancyRate}%`,
      hint: `${data.ipd!.activeAdmissions} active admissions`,
      href: '/ipd',
      icon: BedDouble,
      tone: data.ipd!.occupancyRate >= 85 ? 'warning' : 'success',
    });
  }
  if (data.nursing && ['nurse', 'manager', 'workspace'].includes(kind)) {
    base.push({
      title: 'Nursing tasks',
      value: data.nursing.vitalsDue,
      hint: `${data.nursing.medsToday} meds, ${data.nursing.notesToday} notes today`,
      href: '/nursing',
      icon: HeartPulse,
      tone: data.nursing.vitalsDue > 0 ? 'warning' : 'success',
    });
  }
  if (includeInsurance && ['manager', 'finance', 'insurance', 'workspace'].includes(kind)) {
    base.push({
      title: 'Insurance',
      value: money(data.insurance!.approvedOutstanding),
      hint: `${data.insurance!.submitted + data.insurance!.underReview} open claims`,
      href: '/insurance',
      icon: ShieldCheck,
      tone: data.insurance!.approvedOutstanding > 0 ? 'warning' : 'success',
    });
  }

  return base.slice(0, 8);
}

function roleShortcuts(kind: DashboardKind, modules: Set<string>, roles: Set<string>): ShortcutDef[] {
  const shortcuts: ShortcutDef[] = [];
  const add = (condition: boolean, shortcut: ShortcutDef) => {
    if (condition) shortcuts.push(shortcut);
  };

  switch (kind) {
    case 'manager':
      add(modules.has('REPORTS'), { href: '/manager', icon: Activity, label: 'Manager view' });
      add(modules.has('REPORTS'), { href: '/reports/operations', icon: FileText, label: 'Operations report' });
      add(modules.has('BILLING'), { href: '/finance', icon: Banknote, label: 'Finance center' });
      add(modules.has('INVENTORY'), { href: '/inventory', icon: Warehouse, label: 'Inventory' });
      break;
    case 'reception':
      add(modules.has('PATIENT'), { href: '/patients?new=1', icon: Users, label: 'Register patient' });
      add(modules.has('OPD'), { href: '/reception', icon: ClipboardList, label: 'Check in patient' });
      add(modules.has('OPD'), { href: '/opd', icon: Stethoscope, label: 'Live OPD queue' });
      add(modules.has('BILLING'), { href: '/finance/pending-charges', icon: Banknote, label: 'Pending charges' });
      break;
    case 'doctor':
      add(modules.has('OPD'), { href: '/doctor', icon: Stethoscope, label: 'Consult queue' });
      add(modules.has('LAB'), { href: '/lab', icon: FlaskConical, label: 'Lab results' });
      add(modules.has('IPD'), { href: '/ipd', icon: BedDouble, label: 'IPD patients' });
      add(modules.has('REPORTS'), { href: '/reports/clinical', icon: FileText, label: 'Clinical report' });
      break;
    case 'nurse':
      add(modules.has('IPD'), { href: '/nursing', icon: HeartPulse, label: 'Nursing dashboard' });
      add(modules.has('IPD'), { href: '/ipd', icon: BedDouble, label: 'IPD beds' });
      add(modules.has('PATIENT'), { href: '/patients', icon: Users, label: 'Patient records' });
      break;
    case 'lab':
      add(modules.has('LAB'), { href: '/lab', icon: FlaskConical, label: 'Lab queue' });
      add(modules.has('REPORTS'), { href: '/reports/clinical', icon: FileText, label: 'Clinical report' });
      break;
    case 'pharmacy':
      add(modules.has('PHARMACY'), { href: '/pharmacy', icon: Pill, label: 'Dispense queue' });
      add(modules.has('INVENTORY'), { href: '/inventory', icon: Warehouse, label: 'Stock view' });
      break;
    case 'inventory':
      add(modules.has('INVENTORY'), { href: '/inventory/items', icon: Warehouse, label: 'Item master' });
      add(modules.has('INVENTORY'), { href: '/inventory/purchases', icon: ClipboardList, label: 'Purchase orders' });
      add(modules.has('INVENTORY'), { href: '/inventory/transactions', icon: FileText, label: 'Stock ledger' });
      add(modules.has('REPORTS'), { href: '/reports/inventory', icon: Activity, label: 'Inventory report' });
      break;
    case 'finance':
      add(modules.has('BILLING'), { href: '/finance/cashier', icon: Banknote, label: 'Cashier' });
      add(modules.has('BILLING'), { href: '/finance/pending-charges', icon: ClipboardList, label: 'Pending charges' });
      add(modules.has('BILLING'), { href: '/finance/day-close', icon: CheckCircle2, label: 'Day close' });
      add(modules.has('INSURANCE'), {
        href: '/finance/insurance-receivables',
        icon: ShieldCheck,
        label: 'Insurance receivables',
      });
      break;
    case 'insurance':
      add(modules.has('INSURANCE'), { href: '/insurance', icon: ShieldCheck, label: 'Claims workbench' });
      add(modules.has('BILLING'), { href: '/finance/insurance-receivables', icon: Banknote, label: 'Receivables' });
      add(modules.has('REPORTS'), { href: '/reports/financial', icon: FileText, label: 'Financial report' });
      break;
    default:
      add(modules.has('PATIENT'), { href: '/patients', icon: Users, label: 'Patients' });
      add(modules.has('OPD'), { href: roles.has('DOCTOR') ? '/doctor' : '/opd', icon: Stethoscope, label: 'OPD' });
      add(modules.has('BILLING'), { href: '/finance', icon: Banknote, label: 'Finance' });
      add(modules.has('REPORTS'), { href: '/reports', icon: FileText, label: 'Reports' });
  }

  if (shortcuts.length === 0) shortcuts.push({ href: '/support', icon: Wrench, label: 'Support' });
  return shortcuts;
}

function roleScore(kind: DashboardKind, data: DashboardReport): number {
  const collection = collectionRate(data);
  switch (kind) {
    case 'reception':
    case 'doctor':
      return data.opd?.completionRate ?? 0;
    case 'nurse': {
      const admissions = Math.max(data.ipd?.activeAdmissions ?? 0, 1);
      return ((admissions - (data.nursing?.vitalsDue ?? 0)) / admissions) * 100;
    }
    case 'lab': {
      const total = labPendingCount(data) + (data.lab?.completedToday ?? 0);
      return total ? ((data.lab?.completedToday ?? 0) / total) * 100 : 100;
    }
    case 'pharmacy': {
      const total = (data.pharmacy?.pendingPrescriptions ?? 0) + (data.pharmacy?.dispensedToday ?? 0);
      return total ? ((data.pharmacy?.dispensedToday ?? 0) / total) * 100 : 100;
    }
    case 'inventory': {
      const total = Math.max(data.inventory?.itemCount ?? 0, 1);
      return ((total - (data.inventory?.lowStock ?? 0)) / total) * 100;
    }
    case 'finance':
      return collection;
    case 'insurance': {
      const total =
        (data.insurance?.submitted ?? 0) +
        (data.insurance?.underReview ?? 0) +
        (data.insurance?.approved ?? 0) +
        (data.insurance?.settled ?? 0) +
        (data.insurance?.rejected ?? 0);
      return total ? ((data.insurance?.settled ?? 0) / total) * 100 : 100;
    }
    default:
      return Math.round(
        ((data.opd?.completionRate ?? 0) + collection + (100 - Math.min(data.alerts.length * 15, 60))) / 3,
      );
  }
}

function labPendingCount(data: DashboardReport): number {
  return (data.lab?.ordered ?? 0) + (data.lab?.sampleCollected ?? 0) + (data.lab?.processing ?? 0);
}

function collectionRate(data: DashboardReport): number {
  const billed = data.billing?.billedToday ?? 0;
  const paid = data.billing?.paidToday ?? 0;
  const target = Math.max(billed, paid, 1);
  return Math.round((paid / target) * 100);
}

function ProgressDial({
  value,
  label,
  href = '/dashboard',
  linkLabel = 'Open workspace',
}: {
  value: number;
  label: string;
  href?: string;
  linkLabel?: string;
}) {
  const safe = clamp(value, 0, 100);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="grid h-36 w-36 place-items-center rounded-full"
        style={{ background: `conic-gradient(#2170e4 ${safe * 3.6}deg, #e2e8f0 0deg)` }}
      >
        <div className="grid h-28 w-28 place-items-center rounded-full bg-surface text-center">
          <div>
            <div className="text-headline-md text-ink">{safe}%</div>
            <div className="text-label-sm uppercase text-ink-soft">{label}</div>
          </div>
        </div>
      </div>
      <Link href={href} className="text-body-sm font-medium text-primary hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}

function HealthMeter({
  label,
  value,
  max,
  hint,
  suffix = '',
  tone = 'primary',
}: {
  label: string;
  value: number;
  max: number;
  hint: string;
  suffix?: string;
  tone?: HealthTone;
}) {
  const pct = clamp(max > 0 ? (value / max) * 100 : 0, 0, 100);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-body-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-ink-muted">
          {Number.isFinite(value) ? Math.round(value) : 0}
          {suffix}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
        <div className={cx('h-full rounded-full', toneBg(tone))} style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <div className="mt-1 text-body-sm text-ink-soft">{hint}</div>
    </div>
  );
}

function WatchRow({
  icon: Icon,
  title,
  body,
  href,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  tone: HealthTone;
}) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-canvas">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md', toneSoftBg(tone))}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="font-medium text-ink">{title}</div>
          <div className="mt-0.5 text-body-sm text-ink-soft">{body}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft" />
    </Link>
  );
}

function AdminModuleCard({
  title,
  value,
  hint,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  value: ReactNode;
  hint: string;
  href: string;
  icon: LucideIcon;
  tone: HealthTone;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-line p-4 transition hover:border-primary/60 hover:bg-primary-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-label-md uppercase text-ink-muted">{title}</div>
          <div className="mt-2 text-headline-sm text-ink">{value}</div>
        </div>
        <span className={cx('grid h-9 w-9 place-items-center rounded-md', toneSoftBg(tone))}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-body-sm text-ink-soft">{hint}</div>
    </Link>
  );
}

function Shortcut({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md border border-line px-3 py-3 transition hover:border-primary/60 hover:bg-primary-50"
    >
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary-100 text-primary-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-body-sm font-medium text-ink">{label}</span>
    </Link>
  );
}

function toneBg(tone: HealthTone): string {
  switch (tone) {
    case 'success':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'danger':
      return 'bg-danger';
    case 'slate':
      return 'bg-slate-400';
    default:
      return 'bg-primary';
  }
}

function toneSoftBg(tone: HealthTone): string {
  switch (tone) {
    case 'success':
      return 'bg-success-bg text-success-fg';
    case 'warning':
      return 'bg-warning-bg text-warning-fg';
    case 'danger':
      return 'bg-danger-bg text-danger-fg';
    case 'slate':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-primary-50 text-primary-700';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export default function DashboardPage() {
  return (
    <Protected>
      <DashboardInner />
    </Protected>
  );
}
