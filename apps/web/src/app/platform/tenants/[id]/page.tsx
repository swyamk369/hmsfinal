'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, CheckCircle2, UserPlus, Mail } from 'lucide-react';
import Protected from '@/components/Protected';
import {
  Button,
  Card,
  Section,
  FormField,
  Input,
  Modal,
  ReasonModal,
  PageHeader,
  StatusChip,
  Badge,
  Spinner,
  ErrorState,
  EmptyState,
  cx,
} from '@/components/ui';
import { MODULE_CODES, MODULE_LABELS } from '@/lib/constants';
import { platformApi, type TenantDetail } from '@/lib/platform';

function inr(minor: number): string {
  if (!minor) return 'Custom';
  return '₹' + (minor / 100).toLocaleString('en-IN');
}

function TenantDetailInner({ id }: { id: string }) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pendingModule, setPendingModule] = useState<string | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setTenant(await platformApi.getTenant(id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledModules = new Set((tenant?.modules ?? []).filter((m) => m.enabled).map((m) => m.moduleCode));

  async function toggleModule(code: string, next: boolean) {
    setPendingModule(code);
    setActionErr(null);
    try {
      await platformApi.setModule(id, code, next);
      await load();
    } catch (e) {
      setActionErr((e as Error).message);
    } finally {
      setPendingModule(null);
    }
  }

  async function activate() {
    setActivating(true);
    setActionErr(null);
    try {
      await platformApi.activate(id);
      await load();
    } catch (e) {
      setActionErr((e as Error).message);
    } finally {
      setActivating(false);
    }
  }

  if (err) return <ErrorState message={err} />;
  if (!tenant) return <Spinner label="Loading tenant…" />;

  return (
    <>
      <Link
        href="/platform"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tenants
      </Link>

      <PageHeader
        title={tenant.name}
        subtitle={tenant.slug}
        action={
          tenant.status === 'SUSPENDED' ? (
            <Button icon={CheckCircle2} onClick={activate} loading={activating}>
              Reactivate tenant
            </Button>
          ) : (
            <Button variant="danger" icon={Ban} onClick={() => setSuspendOpen(true)}>
              Suspend tenant
            </Button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusChip status={tenant.status} />
        <Badge tone="primary">{tenant.tier}</Badge>
        <span className="text-body-sm text-ink-soft">{tenant.staffCount} staff</span>
      </div>

      {actionErr && (
        <div className="mb-4">
          <ErrorState message={actionErr} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subscription */}
        <Section title="Subscription" className="lg:col-span-1">
          <div className="space-y-3 px-5 py-4 text-body-sm">
            <Row label="Plan" value={tenant.plan?.name ?? '—'} />
            <Row
              label="Status"
              value={tenant.subscription ? <StatusChip status={tenant.subscription.status} /> : '—'}
            />
            <Row label="Price" value={tenant.plan ? `${inr(tenant.plan.priceInr)}/mo` : '—'} />
            <Row label="User limit" value={tenant.plan?.userLimit ?? 'Unlimited'} />
            <Row
              label="Renews"
              value={
                tenant.subscription?.currentPeriodEnd
                  ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()
                  : '—'
              }
            />
          </div>
        </Section>

        {/* Modules */}
        <Section
          title="Module entitlements"
          className="lg:col-span-2"
          action={<span className="text-body-sm text-ink-soft">{enabledModules.size} enabled</span>}
        >
          <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
            {MODULE_CODES.map((code) => {
              const on = enabledModules.has(code);
              const locked = code === 'ADMIN';
              return (
                <div key={code} className="flex items-center justify-between rounded-md border border-line px-3 py-2.5">
                  <div>
                    <div className="text-body-sm font-medium text-ink">{code}</div>
                    <div className="text-label-sm text-ink-soft">{MODULE_LABELS[code]}</div>
                  </div>
                  <Toggle
                    checked={on}
                    disabled={locked || pendingModule === code}
                    onChange={(next) => toggleModule(code, next)}
                  />
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* Admins */}
      <Section
        title="Hospital Administrators"
        className="mt-6"
        action={
          <Button size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
            Invite Admin
          </Button>
        }
      >
        {tenant.admins.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={Mail}
              title="No Hospital Admin yet"
              hint="Invite the first Hospital Admin so they can configure the workspace and add staff."
              action={
                <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
                  Invite Admin
                </Button>
              }
            />
          </div>
        ) : (
          <table className="w-full text-body-sm">
            <tbody className="divide-y divide-line">
              {tenant.admins.map((a) => (
                <tr key={a.userId}>
                  <td className="px-5 py-3 font-medium text-ink">{a.fullName}</td>
                  <td className="px-5 py-3 text-ink-muted">{a.email}</td>
                  <td className="px-5 py-3 text-right">
                    <StatusChip status={a.active ? 'ACTIVE' : 'SUSPENDED'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <ReasonModal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title="Suspend tenant"
        description={`Suspending "${tenant.name}" blocks all of its users from clinical and operational modules until reactivated.`}
        confirmLabel="Suspend tenant"
        onConfirm={async (reason) => {
          await platformApi.suspend(id, reason);
          await load();
        }}
      />

      <InviteAdminModal open={inviteOpen} onClose={() => setInviteOpen(false)} tenantId={id} onInvited={load} />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-slate-300',
      )}
    >
      <span
        className={cx(
          'inline-block h-4 w-4 transform rounded-full bg-white transition',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function InviteAdminModal({
  open,
  onClose,
  tenantId,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  onInvited: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setFullName('');
      setPassword('');
      setErr(null);
    }
  }, [open]);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await platformApi.inviteAdmin(tenantId, { email: email.trim(), fullName: fullName.trim(), password });
      await onInvited();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite Hospital Admin"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!email.trim() || !fullName.trim() || password.length < 8}>
            Send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <FormField label="Full name" required>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Doe" autoFocus />
        </FormField>
        <FormField label="Work email" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@hospital.org"
          />
        </FormField>
        <FormField
          label="Temporary password"
          required
          hint="Min 8 characters. Share securely; the admin should change it on first login."
        >
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password"
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requirePlatform>
      <TenantDetailInner id={params.id} />
    </Protected>
  );
}
