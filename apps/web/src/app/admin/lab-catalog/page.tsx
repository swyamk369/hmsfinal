'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, FlaskConical, Pencil } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { adminApi, type LabTest, formatMoney, parseMoneyToMinor } from '@/lib/admin';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  PageHeader,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
} from '@/components/ui';

function LabCatalogInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<LabTest[] | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      const [tests, profile] = await Promise.all([
        adminApi.listLabTests(activeTenantId),
        adminApi.getProfile(activeTenantId),
      ]);
      setRows(tests);
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

  async function toggleActive(t: LabTest) {
    if (!activeTenantId) return;
    try {
      await adminApi.updateLabTest(activeTenantId, t.id, { active: !t.active });
      toast.success(t.active ? 'Lab test deactivated.' : 'Lab test activated.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Lab Test Catalog"
        subtitle="Tests available for lab orders and billing"
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New test
          </Button>
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading lab tests…" />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon={FlaskConical}
          title="No lab tests yet"
          hint="Add tests like CBC or Lipid Profile so doctors can order them."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New test
            </Button>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <Section title={`${rows.length} ${rows.length === 1 ? 'test' : 'tests'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Specimen</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-mono text-ink-muted">{t.code}</td>
                    <td className="px-5 py-3 font-medium text-ink">{t.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{t.specimenType || '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-ink">{formatMoney(t.price, currency)}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={t.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(t)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(t)}>
                          {t.active ? 'Deactivate' : 'Activate'}
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

      <LabTestModal
        open={creating || !!editing}
        test={editing}
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

function LabTestModal({
  open,
  test,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  test: LabTest | null;
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [specimenType, setSpecimenType] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCode(test?.code ?? '');
      setName(test?.name ?? '');
      setSpecimenType(test?.specimenType ?? '');
      setPrice(test ? (test.price / 100).toString() : '');
      setErrs({});
    }
  }, [open, test]);

  async function submit() {
    if (!activeTenantId) return;
    const e: Record<string, string> = {};
    if (!test && !code.trim()) e.code = 'Code is required.';
    if (!name.trim()) e.name = 'Name is required.';
    const priceMinor = parseMoneyToMinor(price);
    if (priceMinor === null) e.price = 'Enter a valid price.';
    setErrs(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      if (test) {
        await adminApi.updateLabTest(activeTenantId, test.id, {
          name: name.trim(),
          specimenType: specimenType.trim() || undefined,
          price: priceMinor!,
        });
      } else {
        await adminApi.createLabTest(activeTenantId, {
          code: code.trim(),
          name: name.trim(),
          specimenType: specimenType.trim() || undefined,
          price: priceMinor!,
        });
      }
      toast.success(test ? 'Lab test updated.' : 'Lab test created.');
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
      title={test ? 'Edit lab test' : 'New lab test'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            {test ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Code" required error={errs.code} hint={test ? 'Code cannot be changed' : undefined}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CBC" disabled={!!test} />
          </FormField>
          <FormField label={`Price (${currency})`} required error={errs.price}>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="350.00" inputMode="decimal" />
          </FormField>
        </div>
        <FormField label="Name" required error={errs.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Complete Blood Count" />
        </FormField>
        <FormField label="Specimen type" hint="e.g. Blood, Urine, Serum">
          <Input value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} placeholder="Blood" />
        </FormField>
      </div>
    </Modal>
  );
}

export default function LabCatalogPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']} requireModule="LAB">
      <LabCatalogInner />
    </Protected>
  );
}
