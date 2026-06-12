'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { financeApi, type DayCloseSummary } from '@/lib/finance';
import { formatDateTime, money } from '@/lib/format';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  ReasonModal,
  Section,
  Spinner,
  StatCard,
  StatusChip,
  Textarea,
} from '@/components/ui';
import { FinanceShell } from '../finance-ui';

function DayCloseInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const [data, setData] = useState<DayCloseSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [reopenId, setReopenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await financeApi.dayClose(t, date ? { date } : {}));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [date, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function closeDay() {
    if (!t) return;
    setBusy(true);
    try {
      await financeApi.closeDay(t, { businessDate: date || undefined, notes: notes.trim() || undefined });
      toast.success('Day closed.');
      setNotes('');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Day Close"
        subtitle="Daily collection, refund, cancellation, and net settlement review"
        action={
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />
      <FinanceShell>
        <div className="space-y-6">
          <Section title="Business date">
            <div className="grid gap-4 p-5 md:grid-cols-[220px_auto]">
              <FormField label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormField>
              <div className="flex items-end">
                <Button variant="dark" onClick={load}>
                  Load
                </Button>
              </div>
            </div>
          </Section>
          {err && <ErrorState message={err} />}
          {!data ? (
            <Spinner label="Loading day close..." />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Gross collection" value={money(data.grossCollection)} />
                <StatCard label="Refunds" value={money(data.refundTotal)} />
                <StatCard label="Cancellations" value={money(data.cancellationTotal)} />
                <StatCard label="Net collection" value={money(data.netCollection)} />
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <Section title="Payment split" className="xl:col-span-2">
                  <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    <CloseMetric label="Cash" value={data.cashTotal} />
                    <CloseMetric label="Card" value={data.cardTotal} />
                    <CloseMetric label="UPI" value={data.upiTotal} />
                    <CloseMetric label="Bank" value={data.bankTotal} />
                    <CloseMetric label="Insurance" value={data.insuranceTotal} />
                    <CloseMetric label="Other" value={data.otherTotal} />
                  </div>
                </Section>
                <Section title="Close status">
                  <div className="space-y-4 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-ink-muted">Status</span>
                      <StatusChip status={data.status} />
                    </div>
                    <FormField label="Closing notes">
                      <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </FormField>
                    <Button icon={CheckCircle2} loading={busy} onClick={closeDay} disabled={data.status === 'CLOSED'}>
                      Close Day
                    </Button>
                  </div>
                </Section>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Section title="Payments">
                  {data.payments.length === 0 ? (
                    <div className="p-5">
                      <EmptyState title="No payments for this date" />
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {data.payments.slice(0, 12).map((p: any) => (
                        <li key={p.id} className="flex items-center justify-between px-5 py-3 text-body-sm">
                          <span className="text-ink">
                            {p.method.replace(/_/g, ' ')} · {formatDateTime(p.createdAt)}
                          </span>
                          <span className="font-medium text-success-fg">{money(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="Close records">
                  {data.closes.length === 0 ? (
                    <div className="p-5">
                      <EmptyState title="No close record yet" />
                    </div>
                  ) : (
                    <ul className="divide-y divide-line">
                      {data.closes.map((close: any) => (
                        <li
                          key={close.id}
                          className="flex flex-col gap-2 px-5 py-3 text-body-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="font-medium text-ink">{formatDateTime(close.closedAt)}</div>
                            <div className="text-label-sm text-ink-soft">{close.notes ?? 'No notes'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status={close.status} />
                            {close.status === 'CLOSED' && (
                              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setReopenId(close.id)}>
                                Request reopen
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
            </>
          )}
        </div>
      </FinanceShell>
      <ReasonModal
        open={!!reopenId}
        onClose={() => setReopenId(null)}
        title="Request day-close reopen"
        description="This creates a finance approval request. The close is reopened only after approval."
        confirmLabel="Request approval"
        onConfirm={async (reason) => {
          await financeApi.requestApproval(t, {
            type: 'DAY_CLOSE_REOPEN',
            entity: 'finance_day_close',
            entityId: reopenId!,
            reason,
          });
          toast.success('Reopen approval requested.');
          await load();
        }}
      />
    </>
  );
}

function CloseMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="text-label-sm text-ink-soft">{label}</div>
      <div className="text-title-lg text-ink">{money(value)}</div>
    </div>
  );
}

export default function DayClosePage() {
  return (
    <Protected
      requireModule="BILLING"
      requirePermission={['finance.day_close', 'finance.reconcile', 'reports.financial.read']}
    >
      <DayCloseInner />
    </Protected>
  );
}
