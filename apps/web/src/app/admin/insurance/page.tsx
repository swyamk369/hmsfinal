'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Pencil } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { adminApi, type InsuranceProvider } from '@/lib/admin';
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

function InsuranceInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<InsuranceProvider[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<InsuranceProvider | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      setRows(await adminApi.listInsuranceProviders(activeTenantId));
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

  async function toggleActive(p: InsuranceProvider) {
    if (!activeTenantId) return;
    try {
      await adminApi.updateInsuranceProvider(activeTenantId, p.id, { active: !p.active });
      toast.success(p.active ? 'Provider deactivated.' : 'Provider activated.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Insurance Providers"
        subtitle="Payer directory for claims and policies"
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New provider
          </Button>
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading providers…" />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title="No insurance providers yet"
          hint="Add payers like BlueCross or a TPA so patient policies and claims can reference them."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New provider
            </Button>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <Section title={`${rows.length} ${rows.length === 1 ? 'provider' : 'providers'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-medium text-ink">{p.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{p.contact || '—'}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={p.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(p)}>
                          {p.active ? 'Deactivate' : 'Activate'}
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

      <ProviderModal
        open={creating || !!editing}
        provider={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={load}
      />
    </>
  );
}

function ProviderModal({
  open,
  provider,
  onClose,
  onSaved,
}: {
  open: boolean;
  provider: InsuranceProvider | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(provider?.name ?? '');
      setContact(provider?.contact ?? '');
      setNameErr(null);
    }
  }, [open, provider]);

  async function submit() {
    if (!activeTenantId) return;
    if (!name.trim()) {
      setNameErr('Name is required.');
      return;
    }
    setBusy(true);
    try {
      const body = { name: name.trim(), contact: contact.trim() || undefined };
      if (provider) await adminApi.updateInsuranceProvider(activeTenantId, provider.id, body);
      else await adminApi.createInsuranceProvider(activeTenantId, body);
      toast.success(provider ? 'Provider updated.' : 'Provider created.');
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
      title={provider ? 'Edit provider' : 'New insurance provider'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            {provider ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Provider name" required error={nameErr}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BlueCross Healthcare" autoFocus />
        </FormField>
        <FormField label="Contact" hint="Contact person, phone, or email">
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="claims@bluecross.com" />
        </FormField>
      </div>
    </Modal>
  );
}

export default function InsurancePage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']} requireModule="INSURANCE">
      <InsuranceInner />
    </Protected>
  );
}
