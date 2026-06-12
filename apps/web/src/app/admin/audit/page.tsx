'use client';

import { useCallback, useEffect, useState } from 'react';
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import Protected from '@/components/Protected';
import AdminTabs from '@/components/AdminTabs';
import { useAuth } from '@/lib/auth-context';
import { adminApi, type AuditFilters, type AuditRow, type AuditSearchResult } from '@/lib/admin';
import { Button, FormField, Input, PageHeader, Spinner, ErrorState, EmptyState } from '@/components/ui';

const PAGE_SIZE = 50;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AuditInner() {
  const { activeTenantId } = useAuth();
  const [data, setData] = useState<AuditSearchResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Draft filters (form state) vs applied filters (what the table shows).
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState<AuditFilters>({});

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    setErr(null);
    setLoading(true);
    try {
      setData(await adminApi.audit(activeTenantId, { ...applied, page, pageSize: PAGE_SIZE }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setPage(1);
    setApplied({
      action: action.trim() || undefined,
      entity: entity.trim() || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    });
  };

  const clearFilters = () => {
    setAction('');
    setEntity('');
    setFrom('');
    setTo('');
    setPage(1);
    setApplied({});
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <AdminTabs />
      <PageHeader
        title="Audit log"
        subtitle="Read-only record of every important action in this hospital. Entries cannot be edited or deleted."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormField label="Action">
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. bill.cancel" />
        </FormField>
        <FormField label="Entity">
          <Input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="e.g. patient" />
        </FormField>
        <FormField label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </FormField>
        <FormField label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FormField>
        <Button onClick={applyFilters}>Apply</Button>
        <Button variant="ghost" onClick={clearFilters}>
          Clear
        </Button>
      </div>

      {err ? (
        <ErrorState message={err} />
      ) : !data && loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" hint="No entries match the current filters." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: AuditRow) => (
                <Row
                  key={r.id}
                  row={r}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                />
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-body-sm text-ink-muted">
            <span>
              {data.total} entr{data.total === 1 ? 'y' : 'ies'} · page {data.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="ghost" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ row, expanded, onToggle }: { row: AuditRow; expanded: boolean; onToggle: () => void }) {
  const hasMeta = row.metadata && Object.keys(row.metadata).length > 0;
  return (
    <>
      <tr className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-muted" onClick={onToggle}>
        <td className="px-3 py-2.5 text-ink-soft">
          {hasMeta ? expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : null}
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">{formatWhen(row.createdAt)}</td>
        <td className="px-4 py-2.5">{row.actor ? (row.actor.fullName ?? row.actor.email) : '—'}</td>
        <td className="px-4 py-2.5 font-mono text-[13px]">{row.action}</td>
        <td className="px-4 py-2.5 text-ink-muted">{row.entity}</td>
        <td className="px-4 py-2.5 font-mono text-[12px] text-ink-soft">{row.entityId ?? '—'}</td>
      </tr>
      {expanded && hasMeta ? (
        <tr className="border-b border-line bg-surface-muted last:border-0">
          <td />
          <td colSpan={5} className="px-4 py-3">
            <pre className="overflow-x-auto rounded bg-surface p-3 text-[12px] leading-relaxed text-ink-muted">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function AuditPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_ADMIN']}>
      <AuditInner />
    </Protected>
  );
}
