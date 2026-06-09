'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Layers, Pencil } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { adminApi, type Department, type Facility } from '@/lib/admin';
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
} from '@/components/ui';

function DepartmentsInner() {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Department[] | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    try {
      const [depts, facs] = await Promise.all([
        adminApi.listDepartments(activeTenantId),
        adminApi.listFacilities(activeTenantId),
      ]);
      setRows(depts);
      setFacilities(facs);
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

  async function toggleActive(d: Department) {
    if (!activeTenantId) return;
    try {
      await adminApi.updateDepartment(activeTenantId, d.id, { active: !d.active });
      toast.success(d.active ? 'Department deactivated.' : 'Department activated.');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Clinical and operational departments"
        action={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            New department
          </Button>
        }
      />
      <AdminTabs />

      {err && <ErrorState message={err} />}
      {!rows && !err && <Spinner label="Loading departments…" />}

      {rows && rows.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No departments yet"
          hint="Create departments like Cardiology, Pediatrics, or Radiology."
          action={
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New department
            </Button>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <Section title={`${rows.length} ${rows.length === 1 ? 'department' : 'departments'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Facility</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-canvas">
                    <td className="px-5 py-3 font-medium text-ink">{d.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{d.facility?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-ink-muted">{d.type || '—'}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={d.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(d)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                          {d.active ? 'Deactivate' : 'Activate'}
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

      <DepartmentModal
        open={creating || !!editing}
        department={editing}
        facilities={facilities}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={load}
      />
    </>
  );
}

function DepartmentModal({
  open,
  department,
  facilities,
  onClose,
  onSaved,
}: {
  open: boolean;
  department: Department | null;
  facilities: Facility[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { activeTenantId } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(department?.name ?? '');
      setType(department?.type ?? '');
      setFacilityId(department?.facilityId ?? '');
      setNameErr(null);
    }
  }, [open, department]);

  async function submit() {
    if (!activeTenantId) return;
    if (!name.trim()) {
      setNameErr('Name is required.');
      return;
    }
    setBusy(true);
    try {
      const body = { name: name.trim(), type: type.trim() || undefined, facilityId: facilityId || undefined };
      if (department) await adminApi.updateDepartment(activeTenantId, department.id, body);
      else await adminApi.createDepartment(activeTenantId, body);
      toast.success(department ? 'Department updated.' : 'Department created.');
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
      title={department ? 'Edit department' : 'New department'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!name.trim()}>
            {department ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Department name" required error={nameErr}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cardiology" autoFocus />
        </FormField>
        <FormField label="Type" hint="Optional, e.g. Clinical, Diagnostic, Support">
          <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Clinical" />
        </FormField>
        <FormField label="Facility">
          <Select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  );
}

export default function DepartmentsPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <DepartmentsInner />
    </Protected>
  );
}
