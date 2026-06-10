'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Plus, Search } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { labApi, LAB_STATUSES, type LabOrder, type LabStats, type LabTestCatalog } from '@/lib/lab';
import { patientsApi, type Patient } from '@/lib/patients';
import { formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
  PageHeader,
  StatCard,
  StatusChip,
  Spinner,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

const GROUPS: { key: string; label: string }[] = [
  { key: 'ORDERED', label: 'Awaiting sample' },
  { key: 'SAMPLE_COLLECTED', label: 'Sample collected' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

function LabDashboard() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const canOrder = perms.has('lab.order');

  const [stats, setStats] = useState<LabStats | null>(null);
  const [orders, setOrders] = useState<LabOrder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      const [s, o] = await Promise.all([labApi.stats(t), labApi.orders(t, params)]);
      setStats(s);
      setOrders(o);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!orders) return [];
    if (!dateFilter) return orders;
    return orders.filter((o) => o.createdAt.slice(0, 10) === dateFilter);
  }, [orders, dateFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, LabOrder[]> = {};
    for (const g of GROUPS) map[g.key] = [];
    for (const o of visible) (map[o.status] ??= []).push(o);
    return map;
  }, [visible]);

  return (
    <>
      <PageHeader
        title="Laboratory"
        subtitle="Orders, sample collection, processing, and verified results"
        action={
          canOrder && (
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              New lab order
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Ordered" value={stats?.ordered ?? '—'} icon={FlaskConical} hint="Awaiting sample" />
        <StatCard label="Samples pending" value={stats?.sampleCollected ?? '—'} hint="Awaiting processing" />
        <StatCard label="Processing" value={stats?.processing ?? '—'} />
        <StatCard label="Pending verification" value={stats?.pendingVerification ?? '—'} />
        <StatCard label="Completed today" value={stats?.completedToday ?? '—'} />
      </div>

      <div className="mb-6 space-y-6">
        <HelpTip title="Lab flow">
          Keep orders moving in order: collect sample, process, enter result, verify, then print the report. Critical and
          abnormal results remain visible until verification.
        </HelpTip>
        <WorkQueuePanel title="Lab work queue" modules={['LAB']} limit={6} compact />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <Input
            className="w-64 pl-9"
            placeholder="Search by patient name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select className="w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {LAB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          className="w-44"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Filter by date"
        />
        {(statusFilter || search || dateFilter) && (
          <Button
            variant="ghost"
            onClick={() => {
              setStatusFilter('');
              setSearch('');
              setDateFilter('');
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {err && <ErrorState message={err} />}
      {!err && orders === null && <Spinner label="Loading lab work…" />}
      {!err && orders !== null && visible.length === 0 && (
        <EmptyState
          title="No lab orders"
          hint={
            canOrder
              ? 'Create one with “New lab order”, or order from a consultation.'
              : 'Orders appear here once a doctor places them.'
          }
          icon={FlaskConical}
        />
      )}

      {!err && orders !== null && visible.length > 0 && (
        <div className="space-y-6">
          {GROUPS.filter((g) => grouped[g.key].length > 0).map((g) => (
            <Section key={g.key} title={`${g.label} · ${grouped[g.key].length}`}>
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-2 font-medium">Patient</th>
                    <th className="px-3 py-2 font-medium">Tests</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium">Ordered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {grouped[g.key].map((o) => (
                    <tr key={o.id} className="cursor-pointer hover:bg-canvas">
                      <td className="px-5 py-2.5">
                        <Link href={`/lab/orders/${o.id}`} className="font-medium text-ink hover:text-primary">
                          {o.patient?.fullName ?? '—'}
                        </Link>
                        <div className="text-label-sm text-ink-soft">MRN {o.patient?.mrn ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">{o.items.map((i) => i.testName).join(', ') || '—'}</td>
                      <td className="px-3 py-2.5">
                        <StatusChip status={o.status} />
                      </td>
                      <td className="px-5 py-2.5 text-ink-soft">{formatDateTime(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ))}
        </div>
      )}

      <CreateOrderModal
        open={createOpen}
        tenantId={t}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          toast.success('Lab order created.');
          await load();
        }}
      />
    </>
  );
}

function CreateOrderModal({
  open,
  tenantId,
  onClose,
  onCreated,
}: {
  open: boolean;
  tenantId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<LabTestCatalog[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientQuery('');
    setPatients([]);
    setPatient(null);
    setPicked(new Set());
    setNotes('');
    labApi
      .catalog(tenantId)
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, [open, tenantId]);

  useEffect(() => {
    if (!open || !patientQuery.trim()) return;
    const handle = setTimeout(() => {
      patientsApi
        .list(tenantId, patientQuery.trim())
        .then(setPatients)
        .catch(() => setPatients([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [open, patientQuery, tenantId]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function go() {
    if (!patient) {
      toast.error('Select a patient.');
      return;
    }
    if (picked.size === 0) {
      toast.error('Select at least one test.');
      return;
    }
    const tests = catalog.filter((c) => picked.has(c.id)).map((c) => ({ testId: c.id, testName: c.name }));
    setBusy(true);
    try {
      await labApi.create(tenantId, { patientId: patient.id, notes: notes.trim() || undefined, tests });
      onClose();
      await onCreated();
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
      title="New lab order"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy} disabled={!patient || picked.size === 0}>
            Create order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Patient" required>
          {patient ? (
            <div className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-body-sm">
              <span className="text-ink">
                {patient.fullName} · <span className="text-ink-soft">MRN {patient.mrn}</span>
              </span>
              <button className="text-label-sm text-primary" onClick={() => setPatient(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Search by name, MRN, or phone…"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                autoFocus
              />
              {patients.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-line text-body-sm">
                  {patients.map((p) => (
                    <li key={p.id}>
                      <button
                        className="block w-full px-3 py-2 text-left hover:bg-canvas"
                        onClick={() => {
                          setPatient(p);
                          setPatients([]);
                        }}
                      >
                        {p.fullName} · <span className="text-ink-soft">MRN {p.mrn}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </FormField>

        <FormField label="Tests" required>
          {catalog.length === 0 ? (
            <p className="text-body-sm text-ink-soft">No lab tests configured. Add tests in the lab catalog first.</p>
          ) : (
            <div className="grid max-h-48 grid-cols-1 gap-1 overflow-auto rounded-md border border-line p-2 sm:grid-cols-2">
              {catalog.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-body-sm hover:bg-canvas">
                  <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="text-ink">{c.name}</span>
                  <span className="ml-auto text-label-sm text-ink-soft">{c.code}</span>
                </label>
              ))}
            </div>
          )}
        </FormField>

        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </FormField>
      </div>
    </Modal>
  );
}

export default function LabPage() {
  return (
    <Protected requireModule="LAB" allowedRoles={['LAB_TECH', 'DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}>
      <LabDashboard />
    </Protected>
  );
}
