'use client';

import { useEffect, useState } from 'react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api';
import RoleHome from '@/components/RoleHome';
import { Spinner, EmptyState, ErrorNote, Badge } from '@/components/ui';

interface LabOrder {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

function LabInner() {
  const { activeTenantId } = useAuth();
  const [rows, setRows] = useState<LabOrder[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    apiGet<LabOrder[]>('/lab/orders', activeTenantId)
      .then(setRows)
      .catch((e) => setErr(e.message));
  }, [activeTenantId]);

  return (
    <RoleHome title="Laboratory" subtitle="Pending orders, samples, and results">
      {err && <ErrorNote message={err} />}
      {!err && rows === null && <Spinner />}
      {!err && rows && rows.length === 0 && (
        <EmptyState
          title="No lab orders yet"
          hint="Orders are created from a doctor consultation (Phase 8). The full lab lifecycle lands in Phase 9/12."
        />
      )}
      {rows && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone="blue">{o.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RoleHome>
  );
}

export default function LabPage() {
  return (
    <Protected requireModule="LAB" allowedRoles={['LAB_TECH', 'DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}>
      <LabInner />
    </Protected>
  );
}
