'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Layers,
  ClipboardList,
  BedDouble,
  FlaskConical,
  ShieldCheck,
  Users,
  CheckCircle2,
  Circle,
  ArrowRight,
  Plus,
} from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { adminApi, type AdminOverview } from '@/lib/admin';
import { Button, PageHeader, Section, Spinner, ErrorState, StatCard, cx } from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

// Routes whose pages exist in Phase 5 (so checklist actions never become dead links).
const LIVE_ROUTES = new Set([
  '/admin/profile',
  '/admin/facilities',
  '/admin/departments',
  '/admin/staff',
  '/admin/catalog',
  '/admin/wards',
  '/admin/lab-catalog',
  '/admin/insurance',
]);

function AdminDashboard() {
  const { activeTenantId, activeMembership } = useAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      setData(await adminApi.overview(activeTenantId));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Hospital Setup"
        subtitle={
          activeMembership?.tenantName ? `Configure ${activeMembership.tenantName}` : 'Configure your workspace'
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!data && !err && <Spinner label="Loading setup overview…" />}

      {data && (
        <div className="space-y-6">
          <HelpTip title="Admin setup guidance">
            Configure profile, departments, catalog, staff, wards, lab catalog, and insurance before pushing teams into
            daily workflows. Role permissions can be reviewed from Admin Roles for each hospital’s access pattern.
          </HelpTip>

          <WorkQueuePanel title="Setup work queue" modules={['ADMIN']} limit={6} compact />

          {/* Setup checklist */}
          <Section
            title="Setup checklist"
            action={
              <span className="text-body-sm text-ink-soft">
                {data.progress.completed} / {data.progress.total} done
              </span>
            }
          >
            <div className="px-5 pt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(data.progress.completed / Math.max(data.progress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
            <ul className="divide-y divide-line px-5 py-2">
              {data.checklist.map((c) => {
                const live = LIVE_ROUTES.has(c.href);
                return (
                  <li key={c.key} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {c.done ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-ink-soft" />
                      )}
                      <span className={cx('text-body-md', c.done ? 'text-ink-muted line-through' : 'text-ink')}>
                        {c.label}
                      </span>
                    </div>
                    {live ? (
                      <Link
                        href={c.done ? c.href : `${c.href}?new=1`}
                        className="inline-flex items-center gap-1 text-body-sm font-medium text-primary hover:underline"
                      >
                        {c.done ? 'Review' : 'Set up'} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="chip bg-slate-100 text-slate-700">Phase 6</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* Counts */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Facilities" value={data.counts.facilities} icon={Building2} />
            <StatCard label="Departments" value={data.counts.departments} icon={Layers} />
            <StatCard label="Catalog items" value={data.counts.catalog} icon={ClipboardList} />
            <StatCard label="Active staff" value={data.counts.staff} icon={Users} />
            {data.modules.ipd && (
              <StatCard
                label="Beds"
                value={data.counts.beds}
                hint={`${data.beds.AVAILABLE} available · ${data.beds.OCCUPIED} occupied`}
                icon={BedDouble}
              />
            )}
            {data.modules.lab && <StatCard label="Lab tests" value={data.counts.labTests} icon={FlaskConical} />}
            {data.modules.insurance && (
              <StatCard label="Insurance payers" value={data.counts.insuranceProviders} icon={ShieldCheck} />
            )}
          </div>

          {/* Profile completion */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Hospital profile" className="lg:col-span-2">
              <div className="grid gap-x-8 gap-y-3 px-5 py-4 text-body-sm sm:grid-cols-2">
                <Row label="Name" value={data.profile.name} />
                <Row label="Plan" value={data.profile.tier} />
                <Row label="Contact email" value={data.profile.contactEmail ?? '—'} />
                <Row label="Phone" value={data.profile.contactPhone ?? '—'} />
                <Row label="Currency" value={data.profile.currency} />
                <Row label="Timezone" value={data.profile.timezone} />
                <Row label="Invoice prefix" value={data.profile.invoicePrefix} />
                <Row label="MRN prefix" value={data.profile.mrnPrefix} />
              </div>
              <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
                <span className={cx('text-body-sm', data.profile.complete ? 'text-success-fg' : 'text-warning-fg')}>
                  {data.profile.complete ? 'Profile complete' : 'Profile incomplete'}
                </span>
                <Link href="/admin/profile">
                  <Button size="sm" variant="ghost">
                    Edit profile
                  </Button>
                </Link>
              </div>
            </Section>

            {/* Quick actions */}
            <Section title="Quick actions">
              <div className="flex flex-col gap-1.5 p-3">
                <QuickAction href="/admin/facilities?new=1" label="Add facility" />
                <QuickAction href="/admin/departments?new=1" label="Add department" />
                <QuickAction href="/admin/catalog?new=1" label="Add catalog item" />
                {data.modules.ipd && <QuickAction href="/admin/wards?new=1" label="Add ward / bed" />}
                {data.modules.lab && <QuickAction href="/admin/lab-catalog?new=1" label="Add lab test" />}
                {data.modules.insurance && <QuickAction href="/admin/insurance?new=1" label="Add insurance provider" />}
              </div>
            </Section>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-soft">{label}</span>
      <span className="truncate font-medium text-ink">{value}</span>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md border border-line px-3 py-2.5 text-body-sm font-medium text-ink transition hover:border-primary hover:bg-primary-50"
    >
      <span className="grid h-6 w-6 place-items-center rounded bg-primary-100 text-primary-700">
        <Plus className="h-3.5 w-3.5" />
      </span>
      {label}
    </Link>
  );
}

export default function AdminPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <AdminDashboard />
    </Protected>
  );
}
