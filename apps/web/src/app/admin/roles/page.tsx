'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Lock, Users } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { staffApi, type RoleTemplate, type PermissionRow } from '@/lib/staff';
import { Section, PageHeader, Spinner, ErrorState, Badge, cx } from '@/components/ui';

const GROUP_LABELS: Record<string, string> = {
  settings: 'Settings',
  facility: 'Facilities',
  department: 'Departments',
  role: 'Roles',
  staff: 'Staff',
  patient: 'Patient Records',
  appointment: 'Appointments',
  queue: 'OPD Queue',
  encounter: 'Encounters',
  consultation: 'Consultation',
  clinical_note: 'Clinical Notes',
  vitals: 'Vitals',
  diagnosis: 'Diagnosis',
  followup: 'Follow-up',
  prescription: 'Prescriptions',
  nursing: 'Nursing',
  medication: 'Medication',
  lab: 'Laboratory',
  pharmacy: 'Pharmacy',
  inventory: 'Inventory',
  bill: 'Billing',
  invoice: 'Invoicing',
  payment: 'Payments',
  ipd: 'Inpatient (IPD)',
  ward: 'Wards',
  bed: 'Beds',
  insurance: 'Insurance',
  reports: 'Reports',
};

function groupLabel(group: string): string {
  return GROUP_LABELS[group] ?? group.replace(/_/g, ' ');
}

function RolesInner() {
  const { activeTenantId } = useAuth();
  const [roles, setRoles] = useState<RoleTemplate[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      const [r, p] = await Promise.all([staffApi.listRoles(activeTenantId), staffApi.listPermissions(activeTenantId)]);
      setRoles(r);
      setPermissions(p);
      setSelectedCode((cur) => cur ?? r[0]?.code ?? null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = roles?.find((r) => r.code === selectedCode) ?? null;

  // Group permissions by domain, preserving spec order.
  const groups = useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const p of permissions) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    }
    return [...map.entries()];
  }, [permissions]);

  const held = useMemo(() => new Set(selected?.permissions ?? []), [selected]);

  return (
    <>
      <PageHeader title="Role Management" subtitle="Access levels and security policies for staff members" />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!roles && !err && <Spinner label="Loading roles…" />}

      {roles && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Role list */}
          <div className="lg:col-span-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-label-md uppercase text-ink-soft">System Roles</span>
              <span className="text-label-sm text-ink-soft">{roles.length} roles</span>
            </div>
            <div className="space-y-2">
              {roles.map((r) => {
                const active = r.code === selectedCode;
                return (
                  <button
                    key={r.code}
                    onClick={() => setSelectedCode(r.code)}
                    className={cx(
                      'w-full rounded-lg border p-4 text-left transition',
                      active
                        ? 'border-primary ring-1 ring-primary/20'
                        : 'border-line hover:border-ink-soft hover:bg-canvas',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={cx('h-4 w-4', active ? 'text-primary' : 'text-ink-soft')} />
                        <span className="text-title-lg text-ink">{r.name}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-label-sm text-ink-muted">
                        <Users className="h-3 w-3" /> {r.memberCount}
                      </span>
                    </div>
                    {r.description && <p className="mt-1.5 text-body-sm text-ink-soft">{r.description}</p>}
                    <div className="mt-2 flex items-center gap-2 text-label-sm text-ink-soft">
                      <span className="font-mono">{r.code}</span>
                      {r.landing && <span>→ {r.landing}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permission matrix */}
          <div className="lg:col-span-8">
            {selected && (
              <Section
                title={`${selected.name} access matrix`}
                action={
                  <span className="inline-flex items-center gap-1.5 text-body-sm text-ink-soft">
                    <Lock className="h-3.5 w-3.5" /> System role · read-only
                  </span>
                }
              >
                <div className="max-h-[calc(100vh-300px)] min-h-[400px] space-y-4 overflow-y-auto p-5">
                  <div className="flex items-center justify-between rounded-md bg-canvas px-3 py-2 text-body-sm">
                    <span className="text-ink-muted">Permissions granted</span>
                    <Badge tone="primary">
                      {held.size} / {permissions.length}
                    </Badge>
                  </div>
                  {groups.map(([group, perms]) => (
                    <div key={group} className="overflow-hidden rounded-lg border border-line">
                      <div className="border-b border-line bg-canvas px-4 py-2 text-label-md font-semibold uppercase text-ink-soft">
                        {groupLabel(group)}
                      </div>
                      <div className="divide-y divide-line">
                        {perms.map((p) => {
                          const on = held.has(p.key);
                          return (
                            <div key={p.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                              <div className="min-w-0">
                                <div className="font-mono text-body-sm text-ink">{p.key}</div>
                                {p.description && <div className="text-label-sm text-ink-soft">{p.description}</div>}
                              </div>
                              <ReadOnlyToggle on={on} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ReadOnlyToggle({ on }: { on: boolean }) {
  return (
    <span
      aria-checked={on}
      role="switch"
      title={on ? 'Granted' : 'Not granted'}
      className={cx(
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full',
        on ? 'bg-primary' : 'bg-slate-200',
      )}
    >
      <span
        className={cx(
          'inline-block h-4 w-4 transform rounded-full bg-white transition',
          on ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </span>
  );
}

export default function RolesPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <RolesInner />
    </Protected>
  );
}
