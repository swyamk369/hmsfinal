'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill, Search, RefreshCw, RotateCcw } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { pharmacyApi, type PharmacyPrescription, type PharmacyStats } from '@/lib/pharmacy';
import { publicAdminApi, type RefillRequestRow } from '@/lib/public-admin';
import { formatDateTime } from '@/lib/format';
import {
  Button,
  Section,
  PageHeader,
  StatCard,
  Spinner,
  ErrorState,
  EmptyState,
  StatusChip,
  Input,
  Select,
} from '@/components/ui';
import { HelpTip, WorkQueuePanel } from '@/components/operations';

function PharmacyInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const [stats, setStats] = useState<PharmacyStats | null>(null);
  const [rows, setRows] = useState<PharmacyPrescription[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('FINALIZED');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = { status };
      if (q.trim()) params.q = q.trim();
      const [s, list] = await Promise.all([pharmacyApi.stats(t), pharmacyApi.listPrescriptions(t, params)]);
      setStats(s);
      setRows(list);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Pharmacy"
        subtitle="Finalized prescriptions awaiting dispensing"
        action={
          <Button variant="ghost" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        }
      />

      {err && <ErrorState message={err} />}

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pending Rx" value={stats.pendingCount} />
          <StatCard label="Dispensed today" value={stats.dispensedToday} />
          <StatCard label="Low stock items" value={stats.lowStockCount} />
          <StatCard label="Near expiry" value={stats.nearExpiry} hint="next 30 days" />
        </div>
      )}

      <div className="mb-6 space-y-6">
        <HelpTip title="Pharmacy flow">
          Dispense finalized prescriptions only after stock is confirmed. Partial dispenses and low-stock risks stay in
          the queue until they are resolved.
        </HelpTip>
        <WorkQueuePanel title="Pharmacy work queue" modules={['PHARMACY', 'INVENTORY']} limit={6} compact />
        <RefillQueue tenantId={t} />
      </div>

      <Section
        title="Prescription queue"
        action={
          <div className="flex items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <Input
                className="w-44 pl-8"
                placeholder="Patient or MRN"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </form>
            <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="FINALIZED">Pending</option>
              <option value="DISPENSED">Dispensed</option>
            </Select>
          </div>
        }
      >
        {!rows ? (
          <Spinner label="Loading prescriptions..." />
        ) : rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              icon={Pill}
              title="No prescriptions in this view"
              hint="Finalized prescriptions from doctors appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Items</th>
                  <th className="px-5 py-3 font-medium">Finalized</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((rx) => (
                  <tr
                    key={rx.id}
                    className="cursor-pointer hover:bg-canvas"
                    onClick={() => router.push(`/pharmacy/dispense/${rx.id}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">{rx.encounter?.patient?.fullName ?? 'Patient'}</div>
                      <div className="text-label-sm text-ink-soft">{rx.encounter?.patient?.mrn}</div>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{rx.items.length} medication(s)</td>
                    <td className="px-5 py-3 text-ink-muted">{formatDateTime(rx.finalizedAt)}</td>
                    <td className="px-5 py-3">
                      <StatusChip status={rx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

/**
 * Patient-initiated prescription refill requests (Phase 23). Approve, reject
 * (reason required), or mark dispensed - the patient is notified of each
 * outcome in their portal.
 */
function RefillQueue({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [status, setStatus] = useState('REQUESTED');
  const [rows, setRows] = useState<RefillRequestRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setErr(null);
    try {
      setRows(await publicAdminApi.listRefillRequests(tenantId, status || undefined));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [tenantId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(row: RefillRequestRow, next: 'APPROVED' | 'REJECTED' | 'DISPENSED') {
    let staffNote: string | undefined;
    if (next === 'REJECTED') {
      const reason = window.prompt('Reason for declining this refill request (required):')?.trim();
      if (!reason) return;
      staffNote = reason;
    }
    setBusyId(row.id);
    try {
      await publicAdminApi.updateRefillRequest(tenantId, row.id, { status: next, staffNote });
      toast.success(`Refill request ${next.toLowerCase()} - the patient has been notified.`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section
      title="Refill requests"
      action={
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="DISPENSED">Dispensed</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </Select>
      }
    >
      {err ? (
        <div className="px-5 py-4">
          <ErrorState message={err} />
        </div>
      ) : !rows ? (
        <Spinner label="Loading refill requests..." />
      ) : rows.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            icon={RotateCcw}
            title="No refill requests in this view"
            hint="Patients raise refill requests from their portal; they appear here for review."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Note</th>
                <th className="px-5 py-3 font-medium">Requested</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{r.patientName ?? 'Patient'}</div>
                    <div className="text-label-sm text-ink-soft">{r.patientMrn}</div>
                  </td>
                  <td className="max-w-xs truncate px-5 py-3 text-ink-muted" title={r.note ?? undefined}>
                    {r.note || '-'}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="px-5 py-3">
                    <StatusChip status={r.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.status === 'REQUESTED' && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" loading={busyId === r.id} onClick={() => update(r, 'APPROVED')}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === r.id}
                          onClick={() => update(r, 'REJECTED')}
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                    {r.status === 'APPROVED' && (
                      <Button size="sm" loading={busyId === r.id} onClick={() => update(r, 'DISPENSED')}>
                        Mark dispensed
                      </Button>
                    )}
                    {(r.status === 'REJECTED' || r.status === 'DISPENSED') && (
                      <span className="text-label-sm text-ink-soft">{r.staffNote || '-'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export default function PharmacyPage() {
  return (
    <Protected requireModule="PHARMACY" allowedRoles={['PHARMACIST', 'HOSPITAL_ADMIN']}>
      <PharmacyInner />
    </Protected>
  );
}
