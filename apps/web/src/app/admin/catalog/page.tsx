'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ClipboardList, Pencil } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import {
  adminApi,
  type CatalogItem,
  CATALOG_TYPES,
  formatMoney,
  parseMoneyToMinor,
  percentToBps,
  bpsToPercent,
} from '@/lib/admin';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  Select,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  Badge,
} from '@/components/ui';

function CatalogInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<CatalogItem[] | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      const [items, profile] = await Promise.all([
        adminApi.listCatalog(activeTenantId),
        adminApi.getProfile(activeTenantId),
      ]);
      setRows(items);
      setCurrency(profile.currency);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new')) setCreating(true);
  }, []);

  async function toggleActive(c: CatalogItem) {
    if (!activeTenantId) return;
    try {
      await adminApi.updateCatalogItem(activeTenantId, c.id, { active: !c.active });
      toast.success(c.active ? 'Item deactivated.' : 'Item activated.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Service Catalog"
        subtitle="Billable services, consultations, and procedures"
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New item
          </Button>
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading catalog…" />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No catalog items yet"
          hint="Add billable services so bills and invoices can reference them."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New item
            </Button>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <Section title={`${rows.length} ${rows.length === 1 ? 'item' : 'items'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 text-right font-medium">Tax</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-mono text-ink-muted">{c.code}</td>
                    <td className="px-5 py-3 font-medium text-ink">{c.name}</td>
                    <td className="px-5 py-3">
                      <Badge tone="slate">{c.type}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-ink">{formatMoney(c.price, currency)}</td>
                    <td className="px-5 py-3 text-right text-ink-muted">{bpsToPercent(c.taxRate)}%</td>
                    <td className="px-5 py-3">
                      <StatusChip status={c.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(c)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>
                          {c.active ? 'Deactivate' : 'Activate'}
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

      <CatalogModal
        open={creating || !!editing}
        item={editing}
        currency={currency}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={load}
      />
    </>
  );
}

function CatalogModal({
  open,
  item,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: CatalogItem | null;
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('CONSULTATION');
  const [price, setPrice] = useState('');
  const [tax, setTax] = useState('0');
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCode(item?.code ?? '');
      setName(item?.name ?? '');
      setType(item?.type ?? 'CONSULTATION');
      setPrice(item ? (item.price / 100).toString() : '');
      setTax(item ? bpsToPercent(item.taxRate) : '0');
      setErrs({});
    }
  }, [open, item]);

  async function submit() {
    if (!activeTenantId) return;
    const e: Record<string, string> = {};
    if (!item && !code.trim()) e.code = 'Code is required.';
    if (!name.trim()) e.name = 'Name is required.';
    const priceMinor = parseMoneyToMinor(price);
    if (priceMinor === null) e.price = 'Enter a valid price.';
    const taxBps = percentToBps(tax);
    if (taxBps === null) e.tax = 'Enter a valid tax %.';
    setErrs(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      if (item) {
        await adminApi.updateCatalogItem(activeTenantId, item.id, {
          name: name.trim(),
          type,
          price: priceMinor!,
          taxRate: taxBps!,
        });
      } else {
        await adminApi.createCatalogItem(activeTenantId, {
          code: code.trim(),
          name: name.trim(),
          type,
          price: priceMinor!,
          taxRate: taxBps!,
        });
      }
      toast.success(item ? 'Catalog item updated.' : 'Catalog item created.');
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
      title={item ? 'Edit catalog item' : 'New catalog item'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {item ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Code" required error={errs.code} hint={item ? 'Code cannot be changed' : undefined}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CONSULT-GEN" disabled={!!item} />
          </FormField>
          <FormField label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {CATALOG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label="Name" required error={errs.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="General Consultation" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={`Price (${currency})`} required error={errs.price}>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500.00" inputMode="decimal" />
          </FormField>
          <FormField label="Tax %" error={errs.tax}>
            <Input value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" inputMode="decimal" />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

export default function CatalogPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <CatalogInner />
    </Protected>
  );
}
