'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type ServicePackage } from '@/lib/finance';
import { money, toMinor } from '@/lib/format';
import { Badge, Button, EmptyState, ErrorState, FormField, Input, Modal, Section, Spinner } from '@/components/ui';

export function PackageList() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [rows, setRows] = useState<ServicePackage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServicePackage | 'new' | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    setRows(null);
    try {
      setRows(await financeApi.servicePackages(t));
    } catch (e) {
      setErr((e as Error).message);
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(row: ServicePackage) {
    try {
      await financeApi.updateServicePackage(t, row.id, { active: !row.active });
      toast.success(row.active ? 'Package deactivated.' : 'Package activated.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {err && <ErrorState message={err} />}
        {!rows ? (
          <Spinner label="Loading packages..." />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No packages found"
            action={
              <Button icon={Plus} onClick={() => setEditing('new')}>
                New package
              </Button>
            }
          />
        ) : (
          <Section
            title="Bundled packages"
            action={
              <Button icon={Plus} onClick={() => setEditing('new')}>
                New package
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-3 font-medium">Code</th>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 text-right font-medium">Fixed Price</th>
                    <th className="px-5 py-3 text-right font-medium">Items</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-canvas">
                      <td className="px-5 py-3 font-mono text-label-md text-ink">{pkg.code}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{pkg.name}</div>
                        {pkg.description && <div className="text-label-sm text-ink-soft">{pkg.description}</div>}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-ink">{money(pkg.fixedPrice)}</td>
                      <td className="px-5 py-3 text-right text-ink-muted">{pkg._count?.items ?? 0}</td>
                      <td className="px-5 py-3">
                        <Badge tone={pkg.active ? 'success' : 'slate'}>{pkg.active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" icon={Edit} onClick={() => setEditing(pkg)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void toggle(pkg)}>
                            {pkg.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>

      <PackageModal
        pkg={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          toast.success(editing === 'new' ? 'Package created.' : 'Package updated.');
          setEditing(null);
          await load();
        }}
      />
    </>
  );
}

function PackageModal({
  pkg,
  onClose,
  onSaved,
}: {
  pkg: ServicePackage | 'new' | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const open = !!pkg;
  const editing = pkg && pkg !== 'new' ? pkg : null;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fixedPrice, setFixedPrice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? '');
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setFixedPrice(editing ? String(editing.fixedPrice / 100) : '');
    setBusy(false);
  }, [editing, open]);

  async function submit() {
    const parsed = toMinor(fixedPrice);
    if (!activeTenantId || !name.trim() || !parsed || parsed <= 0) return;
    setBusy(true);
    try {
      if (editing) {
        await financeApi.updateServicePackage(activeTenantId, editing.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          fixedPrice: parsed,
        });
      } else {
        await financeApi.createServicePackage(activeTenantId, {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          fixedPrice: parsed,
        });
      }
      await onSaved();
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
      title={editing ? 'Edit service package' : 'Create service package'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={!name.trim() || !toMinor(fixedPrice) || (!editing && !code.trim())}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Code" required>
          <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={!!editing} />
        </FormField>
        <FormField label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Fixed price" required>
          <Input type="number" min="0" step="0.01" value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}
