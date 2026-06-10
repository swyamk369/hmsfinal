'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Search, Truck } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { supplierApi, type Supplier } from '@/lib/inventory';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  Textarea,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  Badge,
} from '@/components/ui';

function SuppliersInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const canManage = useMemo(
    () => new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []).has('inventory.supplier.manage'),
    [profile, activeTenantId],
  );

  const [rows, setRows] = useState<Supplier[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [edit, setEdit] = useState<Supplier | null>(null);

  const load = useCallback(
    async (term?: string) => {
      if (!t) return;
      setErr(null);
      try {
        setRows(await supplierApi.list(t, term));
      } catch (e) {
        setErr((e as Error).message);
      }
    },
    [t],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setCreating(true);
  }, []);

  return (
    <>
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to inventory
      </Link>
      <PageHeader
        title="Vendor Directory"
        subtitle="Suppliers and vendors for procurement"
        action={
          canManage ? (
            <Button icon={Plus} onClick={() => setCreating(true)}>
              Add Vendor
            </Button>
          ) : undefined
        }
      />

      {err && <ErrorState message={err} />}

      <Section
        title="Suppliers"
        action={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load(q.trim());
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input
              className="w-56 pl-8"
              placeholder="Search vendors…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
        }
      >
        {!rows ? (
          <Spinner label="Loading vendors…" />
        ) : rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={Truck}
              title="No vendors yet"
              action={
                canManage ? (
                  <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
                    Add Vendor
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
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Address</th>
                  <th className="px-5 py-3 font-medium">POs</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  {canManage && <th className="px-5 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((sup) => (
                  <tr key={sup.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-medium text-ink">{sup.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{sup.contact || '—'}</td>
                    <td className="px-5 py-3 text-ink-muted">{sup.address || '—'}</td>
                    <td className="px-5 py-3 text-ink-muted">{sup._count?.purchases ?? 0}</td>
                    <td className="px-5 py-3">
                      <Badge tone={sup.active ? 'success' : 'slate'}>{sup.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(sup)}>
                          Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <SupplierModal
        open={creating || !!edit}
        supplier={edit}
        onClose={() => {
          setCreating(false);
          setEdit(null);
        }}
        onSaved={() => load(q.trim())}
      />
    </>
  );
}

function SupplierModal({
  open,
  supplier,
  onClose,
  onSaved,
}: {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', contact: '', address: '', active: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      setForm(
        supplier
          ? {
              name: supplier.name,
              contact: supplier.contact ?? '',
              address: supplier.address ?? '',
              active: supplier.active,
            }
          : { name: '', contact: '', address: '', active: true },
      );
  }, [open, supplier]);

  async function submit() {
    if (!activeTenantId || !form.name.trim()) return;
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        contact: form.contact.trim() || undefined,
        address: form.address.trim() || undefined,
      };
      if (supplier) await supplierApi.update(activeTenantId, supplier.id, { ...body, active: form.active });
      else await supplierApi.create(activeTenantId, body);
      toast.success(supplier ? 'Vendor updated.' : 'Vendor added.');
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
      title={supplier ? 'Edit vendor' : 'Add vendor'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!form.name.trim()}>
            {supplier ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Vendor name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="MediCorp Global"
            autoFocus
          />
        </FormField>
        <FormField label="Contact (person / phone / email)">
          <Input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
        </FormField>
        <FormField label="Address">
          <Textarea
            rows={2}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </FormField>
        {supplier && (
          <label className="flex items-center gap-2 text-body-sm text-ink-muted">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
            />
            Active (uncheck to deactivate)
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function SuppliersPage() {
  return (
    <Protected requireModule="INVENTORY" allowedRoles={['INVENTORY_MGR', 'HOSPITAL_ADMIN']}>
      <SuppliersInner />
    </Protected>
  );
}
