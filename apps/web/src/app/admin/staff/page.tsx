'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, Users, Search, KeyRound, Ban, RotateCcw, X, Copy, Check } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ROLE_LABELS } from '@/lib/constants';
import { staffApi, rolesNeedProvider, type StaffMember, type RoleTemplate } from '@/lib/staff';
import { adminApi, type Department } from '@/lib/admin';
import {
  Button,
  Section,
  Modal,
  ReasonModal,
  FormField,
  Input,
  Select,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  Badge,
  cx,
} from '@/components/ui';

function StaffInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // filters
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      const [s, r, d] = await Promise.all([
        staffApi.list(activeTenantId),
        staffApi.listRoles(activeTenantId),
        adminApi.listDepartments(activeTenantId),
      ]);
      setStaff(s);
      setRoles(r);
      setDepartments(d);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setInviteOpen(true);
  }, []);

  const selected = staff?.find((s) => s.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    if (!staff) return [];
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (roleFilter && !s.roles.includes(roleFilter)) return false;
      if (deptFilter && s.departmentId !== deptFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (q && !`${s.fullName} ${s.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, roleFilter, deptFilter, statusFilter, search]);

  return (
    <>
      <PageHeader
        title="Staff & Roles"
        subtitle="Invite team members, assign roles, and manage provider profiles"
        action={
          <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
            Invite staff
          </Button>
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!staff && !err && <Spinner label="Loading staff…" />}

      {staff && (
        <Section
          title={`${filtered.length} of ${staff.length} staff`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <Input
                  className="w-44 pl-8"
                  placeholder="Search name/email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select className="w-36" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Select className="w-40" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Select className="w-32" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState
                icon={Users}
                title={staff.length === 0 ? 'No staff yet' : 'No staff match your filters'}
                hint={
                  staff.length === 0
                    ? 'Invite your first team member to get them into the workspace.'
                    : 'Try clearing a filter.'
                }
                action={
                  staff.length === 0 ? (
                    <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
                      Invite staff
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Roles</th>
                    <th className="px-5 py-3 font-medium">Department</th>
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((s) => (
                    <tr key={s.id} className="cursor-pointer hover:bg-canvas" onClick={() => setSelectedId(s.id)}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{s.fullName}</div>
                        <div className="text-label-sm text-ink-soft">{s.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.roles.slice(0, 2).map((r) => (
                            <Badge key={r} tone="slate">
                              {ROLE_LABELS[r] ?? r}
                            </Badge>
                          ))}
                          {s.roles.length > 2 && <Badge tone="slate">+{s.roles.length - 2}</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{s.departmentName || '—'}</td>
                      <td className="px-5 py-3">
                        {s.providerType ? (
                          <Badge tone="primary">{s.providerType}</Badge>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusChip status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-right text-ink-muted">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <InviteStaffModal
        open={inviteOpen}
        roles={roles}
        departments={departments}
        onClose={() => setInviteOpen(false)}
        onSaved={load}
      />

      {selected && (
        <StaffDrawer
          member={selected}
          roles={roles}
          departments={departments}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </>
  );
}

// ── Invite modal ────────────────────────────────────────────────
function RoleCheckboxes({
  roles,
  selected,
  onToggle,
}: {
  roles: RoleTemplate[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-line p-2">
      {roles.map((r) => (
        <label key={r.code} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-canvas">
          <input
            type="checkbox"
            checked={selected.includes(r.code)}
            onChange={() => onToggle(r.code)}
            className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
          />
          <span className="text-body-sm text-ink">{r.name}</span>
        </label>
      ))}
    </div>
  );
}

function InviteStaffModal({
  open,
  roles,
  departments,
  onClose,
  onSaved,
}: {
  open: boolean;
  roles: RoleTemplate[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setFullName('');
      setEmail('');
      setPhone('');
      setSelectedRoles([]);
      setDepartmentId('');
      setSpeciality('');
      setRegistrationNumber('');
      setErrs({});
    }
  }, [open]);

  const needsProvider = rolesNeedProvider(selectedRoles);

  function toggleRole(code: string) {
    setSelectedRoles((rs) => (rs.includes(code) ? rs.filter((r) => r !== code) : [...rs, code]));
  }

  async function submit() {
    if (!activeTenantId) return;
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (selectedRoles.length === 0) e.roles = 'Select at least one role.';
    if (needsProvider && !departmentId) e.departmentId = 'A department is required for Doctor/Nurse.';
    setErrs(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      await staffApi.invite(activeTenantId, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        roles: selectedRoles,
        departmentId: departmentId || undefined,
        speciality: speciality.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
      });
      toast.success(`Invited ${fullName.trim()}. They set their password via "Forgot password".`);
      await onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite staff"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full name" required error={errs.fullName}>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Jane Doe"
              autoFocus
            />
          </FormField>
          <FormField label="Email" required error={errs.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@hospital.org"
            />
          </FormField>
        </div>
        <FormField label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
        </FormField>
        <FormField label="Roles" required error={errs.roles}>
          <RoleCheckboxes roles={roles} selected={selectedRoles} onToggle={toggleRole} />
        </FormField>
        <FormField
          label="Department"
          required={needsProvider}
          error={errs.departmentId}
          hint={needsProvider ? 'Required because a Doctor/Nurse role is selected.' : 'Optional'}
        >
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">— None —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        {needsProvider && (
          <div className="grid grid-cols-2 gap-4 rounded-md border border-line bg-canvas p-3">
            <FormField label="Speciality" hint="Provider profile">
              <Input value={speciality} onChange={(e) => setSpeciality(e.target.value)} placeholder="Cardiology" />
            </FormField>
            <FormField label="Registration no." hint="Provider profile">
              <Input
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="MCI-12345"
              />
            </FormField>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Detail drawer ───────────────────────────────────────────────
function StaffDrawer({
  member,
  roles,
  departments,
  onClose,
  onChanged,
}: {
  member: StaffMember;
  roles: RoleTemplate[];
  departments: Department[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(member.fullName);
  const [phone, setPhone] = useState(member.phone ?? '');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(member.roles);
  const [departmentId, setDepartmentId] = useState(member.departmentId ?? '');
  const [speciality, setSpeciality] = useState(member.provider?.speciality ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(member.provider?.registrationNumber ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; resetLink: string } | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const t = activeTenantId!;
  const needsProvider = rolesNeedProvider(selectedRoles);

  function toggleRole(code: string) {
    setSelectedRoles((rs) => (rs.includes(code) ? rs.filter((r) => r !== code) : [...rs, code]));
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await staffApi.update(t, member.id, { fullName: fullName.trim(), phone: phone.trim() });
      toast.success('Profile updated.');
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveRoles() {
    if (selectedRoles.length === 0) {
      toast.error('Select at least one role.');
      return;
    }
    if (needsProvider && !departmentId) {
      toast.error('A department is required for Doctor/Nurse roles.');
      return;
    }
    setSavingRoles(true);
    try {
      await staffApi.updateRoles(t, member.id, { roles: selectedRoles, departmentId: departmentId || undefined });
      toast.success('Roles updated.');
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingRoles(false);
    }
  }

  async function saveProvider() {
    if (!member.provider) return;
    setSavingProvider(true);
    try {
      await staffApi.updateProvider(t, member.provider.id, {
        speciality: speciality.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        departmentId: departmentId || undefined,
      });
      toast.success('Provider profile saved.');
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingProvider(false);
    }
  }

  async function reactivate() {
    setBusyAction(true);
    try {
      await staffApi.reactivate(t, member.id);
      toast.success('Staff reactivated.');
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  async function resetPassword() {
    setBusyAction(true);
    try {
      const res = await staffApi.resetPassword(t, member.id);
      setResetResult(res);
      toast.success('Password reset link generated.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-raised">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-title-lg text-ink">{member.fullName}</div>
            <div className="truncate text-body-sm text-ink-soft">{member.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={member.status} />
            <button onClick={onClose} className="rounded p-1 text-ink-soft hover:bg-canvas" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {!member.active && member.deactivationReason && (
            <div className="rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-body-sm text-warning-fg">
              Deactivated: {member.deactivationReason}
            </div>
          )}

          {/* Profile */}
          <DrawerCard title="Profile">
            <FormField label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </FormField>
            <FormField label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveProfile} loading={savingProfile} disabled={!fullName.trim()}>
                Save profile
              </Button>
            </div>
          </DrawerCard>

          {/* Roles & department */}
          <DrawerCard title="Roles & department">
            <RoleCheckboxes roles={roles} selected={selectedRoles} onToggle={toggleRole} />
            <FormField
              label="Department"
              required={needsProvider}
              hint={needsProvider ? 'Required for Doctor/Nurse.' : undefined}
            >
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveRoles} loading={savingRoles}>
                Save roles
              </Button>
            </div>
          </DrawerCard>

          {/* Provider panel */}
          {member.provider ? (
            <DrawerCard title={`Provider profile (${member.provider.type})`}>
              <FormField label="Speciality">
                <Input value={speciality} onChange={(e) => setSpeciality(e.target.value)} placeholder="Cardiology" />
              </FormField>
              <FormField label="Registration number">
                <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
              </FormField>
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-ink-soft">
                  Provider {member.provider.active ? 'active' : 'inactive'}
                </span>
                <Button size="sm" onClick={saveProvider} loading={savingProvider}>
                  Save provider
                </Button>
              </div>
            </DrawerCard>
          ) : (
            <DrawerCard title="Provider profile">
              <p className="text-body-sm text-ink-soft">
                This staff member has no provider profile. Assign a Doctor or Nurse role to create one.
              </p>
            </DrawerCard>
          )}

          {/* Lifecycle actions */}
          <DrawerCard title="Account actions">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={KeyRound} onClick={resetPassword} loading={busyAction}>
                Reset password
              </Button>
              {member.active ? (
                <Button size="sm" variant="danger" icon={Ban} onClick={() => setDeactivateOpen(true)}>
                  Deactivate
                </Button>
              ) : (
                <Button size="sm" icon={RotateCcw} onClick={reactivate} loading={busyAction}>
                  Reactivate
                </Button>
              )}
            </div>
          </DrawerCard>
        </div>
      </aside>

      <ReasonModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        title="Deactivate staff member"
        description={`${member.fullName} will lose all access to this hospital until reactivated.`}
        confirmLabel="Deactivate"
        onConfirm={async (reason) => {
          await staffApi.deactivate(t, member.id, reason);
          toast.success('Staff deactivated.');
          await onChanged();
        }}
      />

      <Modal
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="Password reset link"
        footer={<Button onClick={() => setResetResult(null)}>Done</Button>}
      >
        {resetResult && (
          <div className="space-y-3">
            <p className="text-body-sm text-ink-muted">
              Share this one-time link with <span className="font-medium text-ink">{resetResult.email}</span> so they
              can set a new password.
            </p>
            <CopyField value={resetResult.resetLink} />
          </div>
        )}
      </Modal>
    </>
  );
}

function DrawerCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line">
      <div className="border-b border-line px-4 py-2.5 text-label-md font-semibold uppercase text-ink-soft">
        {title}
      </div>
      <div className="space-y-3 px-4 py-3">{children}</div>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        className={cx('input flex-1 font-mono text-label-sm')}
        onFocus={(e) => e.target.select()}
      />
      <Button
        size="sm"
        variant="ghost"
        icon={copied ? Check : Copy}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

export default function StaffPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <StaffInner />
    </Protected>
  );
}
