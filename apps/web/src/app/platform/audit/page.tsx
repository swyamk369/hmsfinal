'use client';

import { useEffect, useState } from 'react';
import Protected from '@/components/Protected';
import { PageHeader, Card, SkeletonTable, EmptyState, ErrorState, Badge } from '@/components/ui';
import { platformApi, type AuditRow } from '@/lib/platform';

function summarize(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '';
  return Object.entries(metadata)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

function actionTone(action: string): 'danger' | 'warning' | 'success' | 'primary' {
  if (action.includes('suspend')) return 'danger';
  if (action.includes('activate') || action.includes('create')) return 'success';
  if (action.includes('invite') || action.includes('modules')) return 'warning';
  return 'primary';
}

function AuditInner() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    platformApi
      .listAudit()
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <PageHeader title="Platform Audit Log" subtitle="Cross-tenant administrative actions, append-only." />
      {err && <ErrorState message={err} />}
      {!err && rows === null && <SkeletonTable rows={6} cols={4} />}
      {!err && rows && rows.length === 0 && (
        <EmptyState
          title="No platform actions yet"
          hint="Tenant create / suspend / module / invite events appear here as they happen."
        />
      )}
      {rows && rows.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-body-sm">
            <thead className="text-left text-label-md uppercase text-ink-soft">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                <th className="px-4 py-2.5 font-semibold">Action</th>
                <th className="px-4 py-2.5 font-semibold">Entity</th>
                <th className="px-4 py-2.5 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={actionTone(r.action)}>{r.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {r.entity}
                    {r.entityId ? (
                      <span className="font-mono text-label-sm text-ink-soft"> · {r.entityId.slice(0, 8)}</span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{summarize(r.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

export default function AuditPage() {
  return (
    <Protected requirePlatform>
      <AuditInner />
    </Protected>
  );
}
