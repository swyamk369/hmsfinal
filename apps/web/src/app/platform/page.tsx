'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, ChevronRight, CheckCircle2, Ban, UsersRound } from 'lucide-react';
import Protected from '@/components/Protected';
import {
  Button,
  Card,
  FormField,
  Input,
  Select,
  Modal,
  PageHeader,
  StatCard,
  StatusChip,
  Badge,
  SkeletonTable,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { platformApi, slugify, type TenantRow, type Plan } from '@/lib/platform';

function PlatformInner() {
  const router = useRouter();
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setErr(null);
    try {
      setRows(await platformApi.listTenants());
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (q && !`${t.name} ${t.slug}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, q, statusFilter]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      active: list.filter((t) => t.status === 'ACTIVE').length,
      suspended: list.filter((t) => t.status === 'SUSPENDED').length,
      staff: list.reduce((s, t) => s + t.staffCount, 0),
    };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Platform Overview"
        subtitle="Manage tenant hospitals, modules, and onboarding."
        action={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            Create New Tenant
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Hospitals" value={stats.total} icon={Building2} />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} />
        <StatCard label="Suspended" value={stats.suspended} icon={Ban} />
        <StatCard label="Total Staff" value={stats.staff} icon={UsersRound} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input className="pl-9" placeholder="Search tenants…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING_SETUP">Pending setup</option>
          </Select>
        </div>

        {err && (
          <div className="p-4">
            <ErrorState message={err} />
          </div>
        )}
        {!err && rows === null && <SkeletonTable rows={5} cols={5} />}
        {!err && rows && filtered.length === 0 && (
          <EmptyState
            title={rows.length === 0 ? 'No hospitals yet' : 'No tenants match your filters'}
            hint={rows.length === 0 ? 'Create your first hospital tenant to get started.' : undefined}
            action={
              rows.length === 0 ? (
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  Create New Tenant
                </Button>
              ) : undefined
            }
          />
        )}

        {filtered.length > 0 && (
          <table className="w-full text-body-sm">
            <thead className="text-left text-label-md uppercase text-ink-soft">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-semibold">Hospital / Slug</th>
                <th className="px-4 py-2.5 font-semibold">Plan</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Modules</th>
                <th className="px-4 py-2.5 font-semibold text-right">Staff</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-canvas"
                  onClick={() => router.push(`/platform/tenants/${t.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{t.name}</div>
                    <div className="font-mono text-label-sm text-ink-soft">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{t.tier}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{t.moduleCount}</td>
                  <td className="px-4 py-3 text-right text-ink">{t.staffCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/tenants/${t.id}`}
                      className="inline-flex text-ink-soft hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          router.push(`/platform/tenants/${id}`);
        }}
      />
    </>
  );
}

function CreateTenantModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [planCode, setPlanCode] = useState('PROFESSIONAL');
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setPlanCode('PROFESSIONAL');
      setContactEmail('');
      setErr(null);
      platformApi
        .listPlans()
        .then(setPlans)
        .catch(() => setPlans([]));
    }
  }, [open]);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const tenant = await platformApi.createTenant({
        name: name.trim(),
        slug: effectiveSlug,
        planCode,
        contactEmail: contactEmail.trim() || undefined,
      });
      onCreated(tenant.id);
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
      title="Create New Tenant"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim() || !effectiveSlug}>
            Create hospital
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <FormField label="Hospital name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mercy General Hospital"
            autoFocus
          />
        </FormField>
        <FormField label="Slug" required hint="Lowercase, hyphenated. Used internally to identify the tenant.">
          <Input
            value={effectiveSlug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="mercy-general"
          />
        </FormField>
        <FormField label="Plan" required hint="Determines which modules are enabled by default.">
          <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.modules.length} modules
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Contact email">
          <Input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="admin@hospital.org"
          />
        </FormField>
      </div>
    </Modal>
  );
}

export default function PlatformPage() {
  return (
    <Protected requirePlatform>
      <PlatformInner />
    </Protected>
  );
}
