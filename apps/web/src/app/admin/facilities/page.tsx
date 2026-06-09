'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Building2, Pencil } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { adminApi, type Facility } from '@/lib/admin';
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

function FacilitiesInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Facility[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      setRows(await adminApi.listFacilities(activeTenantId));
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

  async function toggleActive(f: Facility) {
    if (!activeTenantId) return;
    try {
      await adminApi.updateFacility(activeTenantId, f.id, { active: !f.active });
      toast.success(f.active ? 'Facility deactivated.' : 'Facility activated.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Facilities"
        subtitle="Branches and buildings in your hospital network"
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New facility
          </Button>
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading facilities…" />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No facilities yet"
          hint="Add your first facility so departments and wards can be assigned to it."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New facility
            </Button>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <Section title={`${rows.length} ${rows.length === 1 ? 'facility' : 'facilities'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Address</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((f) => (
                  <tr key={f.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-medium text-ink">{f.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{f.address || '—'}</td>
                    <td className="px-5 py-3 text-ink-muted">{f.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={f.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(f)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(f)}>
                          {f.active ? 'Deactivate' : 'Activate'}
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

      <FacilityModal
        open={creating || !!editing}
        facility={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={load}
      />
    </>
  );
}

function FacilityModal({
  open,
  facility,
  onClose,
  onSaved,
}: {
  open: boolean;
  facility: Facility | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(facility?.name ?? '');
      setAddress(facility?.address ?? '');
      setPhone(facility?.phone ?? '');
      setNameErr(null);
    }
  }, [open, facility]);

  async function submit() {
    if (!activeTenantId) return;
    if (!name.trim()) {
      setNameErr('Name is required.');
      return;
    }
    setBusy(true);
    try {
      const body = { name: name.trim(), address: address.trim(), phone: phone.trim() };
      if (facility) await adminApi.updateFacility(activeTenantId, facility.id, body);
      else await adminApi.createFacility(activeTenantId, body);
      toast.success(facility ? 'Facility updated.' : 'Facility created.');
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
      title={facility ? 'Edit facility' : 'New facility'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            {facility ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Facility name" required error={nameErr}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Hospital" autoFocus />
        </FormField>
        <FormField label="Address">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City" />
        </FormField>
        <FormField label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
        </FormField>
      </div>
    </Modal>
  );
}

export default function FacilitiesPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <FacilitiesInner />
    </Protected>
  );
}
