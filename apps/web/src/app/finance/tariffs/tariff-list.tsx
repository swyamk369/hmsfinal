'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type PriceList } from '@/lib/finance';
import { Badge, Button, EmptyState, ErrorState, FormField, Input, Modal, Section, Spinner } from '@/components/ui';

export function TariffList() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [rows, setRows] = useState<PriceList[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<PriceList | 'new' | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    setRows(null);
    try {
      setRows(await financeApi.priceLists(t));
    } catch (e) {
      setErr((e as Error).message);
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(row: PriceList) {
    try {
      await financeApi.updatePriceList(t, row.id, { active: !row.active });
      toast.success(row.active ? 'Price list deactivated.' : 'Price list activated.');
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
          <Spinner label="Loading price lists..." />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No price lists found"
            action={
              <Button icon={Plus} onClick={() => setEditing('new')}>
                New price list
              </Button>
            }
          />
        ) : (
          <Section
            title="Price lists"
            action={
              <Button icon={Plus} onClick={() => setEditing('new')}>
                New price list
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Description</th>
                    <th className="px-5 py-3 text-right font-medium">Items</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-canvas">
                      <td className="px-5 py-3 font-medium text-ink">{row.name}</td>
                      <td className="px-5 py-3 text-ink-muted">{row.description ?? '-'}</td>
                      <td className="px-5 py-3 text-right text-ink-muted">{row._count?.items ?? 0}</td>
                      <td className="px-5 py-3">
                        <Badge tone={row.active ? 'success' : 'slate'}>{row.active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" icon={Edit} onClick={() => setEditing(row)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void toggle(row)}>
                            {row.active ? 'Deactivate' : 'Activate'}
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

      <PriceListModal
        priceList={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          toast.success(editing === 'new' ? 'Price list created.' : 'Price list updated.');
          setEditing(null);
          await load();
        }}
      />
    </>
  );
}

function PriceListModal({
  priceList,
  onClose,
  onSaved,
}: {
  priceList: PriceList | 'new' | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const open = !!priceList;
  const editing = priceList && priceList !== 'new' ? priceList : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.description ?? '');
    setBusy(false);
  }, [editing, open]);

  async function submit() {
    if (!activeTenantId || !name.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await financeApi.updatePriceList(activeTenantId, editing.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await financeApi.createPriceList(activeTenantId, {
          name: name.trim(),
          description: description.trim() || undefined,
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
      title={editing ? 'Edit price list' : 'Create price list'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}
