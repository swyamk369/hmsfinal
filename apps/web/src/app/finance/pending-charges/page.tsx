'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type BillableCharge } from '@/lib/finance';
import { money } from '@/lib/format';
import { Button, EmptyState, ErrorState, FormField, Input, PageHeader, ReasonModal, Section, Select, Spinner, Textarea } from '@/components/ui';
import { ChargeTable, FinanceShell, FINANCE_PERMS } from '../finance-ui';

function PendingChargesPageInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const router = useRouter();
  const [patientId, setPatientId] = useState('');
  const [rows, setRows] = useState<BillableCharge[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sourceModule, setSourceModule] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.q = q.trim();
      if (sourceModule) params.sourceModule = sourceModule;
      if (patientId) params.patientId = patientId;
      setRows(await financeApi.pendingCharges(t, params));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [patientId, q, sourceModule, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPatientId(new URLSearchParams(window.location.search).get('patientId') ?? '');
  }, []);

  const picked = useMemo(() => (rows ?? []).filter((row) => selected.has(row.id)), [rows, selected]);
  const total = picked.reduce((sum, row) => sum + row.total, 0);
  const mixedPatients = new Set(picked.map((row) => row.patientId)).size > 1;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createBill() {
    setBusy(true);
    try {
      const bill = await financeApi.billFromCharges(t, { chargeIds: Array.from(selected), notes: notes.trim() || undefined });
      toast.success('Bill created from pending charges.');
      router.push(`/finance/bills/${bill.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Pending Charges"
        subtitle={patientId ? 'Unbilled charges for this patient account' : 'Unbilled OPD, lab, pharmacy, IPD, insurance, and manual charges'}
      />
      <FinanceShell>
        <div className="space-y-6">
          {err && <ErrorState message={err} />}
          <Section title="Filters">
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_220px_auto]">
              <FormField label="Search patient or charge">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, MRN, service..." />
              </FormField>
              <FormField label="Source">
                <Select value={sourceModule} onChange={(e) => setSourceModule(e.target.value)}>
                  <option value="">All sources</option>
                  {['OPD', 'LAB', 'PHARMACY', 'IPD', 'MANUAL', 'INSURANCE'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </FormField>
              <div className="flex items-end">
                <Button variant="ghost" onClick={load}>Refresh</Button>
              </div>
            </div>
          </Section>

          <Section title="Create bill from selected charges">
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_220px_auto] md:items-end">
              <FormField label="Bill notes">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional cashier note" />
              </FormField>
              <div className="rounded-md border border-line px-3 py-2">
                <div className="text-label-sm text-ink-soft">Selected total</div>
                <div className="text-title-lg text-ink">{money(total)}</div>
              </div>
              <Button loading={busy} disabled={selected.size === 0 || mixedPatients} onClick={createBill}>
                Create Bill
              </Button>
            </div>
            {mixedPatients && <div className="px-5 pb-4 text-body-sm text-danger">Selected charges must belong to one patient.</div>}
          </Section>

          {!rows ? (
            <Spinner label="Loading charges..." />
          ) : rows.length === 0 ? (
            <EmptyState title="No pending charges" hint="Charges from OPD, lab, pharmacy, IPD, and manual finance actions appear here." />
          ) : (
            <Section title={`${rows.length} pending charge${rows.length === 1 ? '' : 's'}`}>
              <ChargeTable charges={rows} selected={selected} onToggle={toggle} />
              <div className="border-t border-line p-5">
                <Select value={cancelId ?? ''} onChange={(e) => setCancelId(e.target.value || null)}>
                  <option value="">Cancel a pending charge...</option>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>{row.patient?.fullName ?? 'Patient'} - {row.name}</option>
                  ))}
                </Select>
              </div>
            </Section>
          )}
        </div>
      </FinanceShell>
      <ReasonModal
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel pending charge"
        description="Only unbilled charges can be cancelled directly. The reason is kept in the audit trail."
        confirmLabel="Cancel charge"
        onConfirm={async (reason) => {
          await financeApi.cancelCharge(t, cancelId!, reason);
          toast.success('Charge cancelled.');
          await load();
        }}
      />
    </>
  );
}

export default function PendingChargesPage() {
  return (
    <Protected requireModule="BILLING" requirePermission={FINANCE_PERMS}>
      <PendingChargesPageInner />
    </Protected>
  );
}
