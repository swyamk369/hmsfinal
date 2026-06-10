'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill, Search, RefreshCw } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { pharmacyApi, type PharmacyPrescription, type PharmacyStats } from '@/lib/pharmacy';
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
          <Spinner label="Loading prescriptions…" />
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

export default function PharmacyPage() {
  return (
    <Protected requireModule="PHARMACY" allowedRoles={['PHARMACIST', 'HOSPITAL_ADMIN']}>
      <PharmacyInner />
    </Protected>
  );
}
