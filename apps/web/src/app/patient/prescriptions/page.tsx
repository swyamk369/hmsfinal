'use client';

import { useState } from 'react';
import { Pill, RefreshCw, Check } from 'lucide-react';
import { usePortal } from '@/components/patient/portal-shell';
import { useData, Loading, ErrorState, EmptyState, StatusBadge, SubTabs } from '@/components/patient/portal-ui';
import { portalApi, type PortalPrescription, type RefillRequest } from '@/lib/patient-portal';

type Filter = 'active' | 'completed' | 'all' | 'refills';
const ACTIVE = ['ACTIVE', 'FINALIZED', 'DRAFT', 'PENDING'];

export default function PrescriptionsPage() {
  const { tenantId, openLinkModal } = usePortal();
  const [tab, setTab] = useState<Filter>('active');

  if (!tenantId)
    return (
      <EmptyState
        icon={Pill}
        title="Link a hospital to see prescriptions"
        body="Prescriptions shared by your doctor appear once you've linked a hospital record."
        action={<button onClick={openLinkModal} className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">Link a record</button>}
      />
    );
  return <Inner tenantId={tenantId} tab={tab} setTab={setTab} />;
}

function Inner({ tenantId, tab, setTab }: { tenantId: string; tab: Filter; setTab: (f: Filter) => void }) {
  const { data: pData, err: pErr } = useData<PortalPrescription[]>(() => portalApi.prescriptions(tenantId), [tenantId]);
  const { data: rData, err: rErr } = useData<RefillRequest[]>(() => portalApi.refills(tenantId), [tenantId]);
  
  if (pErr || rErr) return <ErrorState msg={pErr || rErr || 'Failed to load'} />;
  if (!pData || !rData) return <Loading label="Loading prescriptions…" />;

  const active = pData.filter((p) => ACTIVE.includes(p.status.toUpperCase()));
  const completed = pData.filter((p) => !ACTIVE.includes(p.status.toUpperCase()));
  const rows = tab === 'active' ? active : tab === 'completed' ? completed : pData;

  return (
    <div>
      <SubTabs<Filter>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'active', label: 'Active', count: active.length },
          { key: 'completed', label: 'Completed', count: completed.length },
          { key: 'all', label: 'All', count: pData.length },
          { key: 'refills', label: 'Refill Requests', count: rData.length },
        ]}
      />
      {tab === 'refills' ? (
        rData.length === 0 ? (
          <EmptyState icon={RefreshCw} title="No refill requests" body="You haven't requested any prescription refills yet." />
        ) : (
          <div className="space-y-3">
            {rData.map((r) => (
              <div key={r.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-body-sm text-ink-soft">{new Date(r.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <StatusBadge status={r.status} />
                </div>
                {r.note && <div className="text-body-sm text-ink mb-2"><strong>Your note:</strong> {r.note}</div>}
                {r.staffNote && <div className="text-body-sm text-ink-muted bg-canvas p-2 rounded mt-2"><strong>Staff note:</strong> {r.staffNote}</div>}
              </div>
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <EmptyState icon={Pill} title="No prescriptions" body="Prescriptions your doctor shares appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-body-sm text-ink-soft">{new Date(p.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <StatusBadge status={p.status} />
              </div>
              <ul className="space-y-1.5">
                {p.items.map((i, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-body-sm">
                    <Pill className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>
                      <span className="font-medium text-ink">{i.drugName}</span>
                      <span className="text-ink-muted">
                        {[i.dosage, i.frequency, i.duration].filter(Boolean).length ? ' · ' + [i.dosage, i.frequency, i.duration].filter(Boolean).join(' · ') : ''}
                      </span>
                      {i.instructions && <span className="block text-label-sm text-ink-soft">{i.instructions}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end border-t border-line pt-3">
                <RefillButton tenantId={tenantId} prescriptionId={p.id} existingRequest={rData.find(r => r.prescriptionId === p.id && r.status === 'PENDING')} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RefillButton({ tenantId, prescriptionId, existingRequest }: { tenantId: string; prescriptionId: string; existingRequest?: RefillRequest }) {
  const [state, setState] = useState<'idle' | 'draft' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function request() {
    setState('busy');
    setMsg(null);
    try {
      await portalApi.createRefill({ tenantId, prescriptionId, note });
      setState('done');
    } catch (e) {
      setState('error');
      setMsg((e as Error).message);
    }
  }

  if (existingRequest) {
    return (
      <span className="inline-flex items-center gap-1.5 text-label-md font-medium text-primary">
        <RefreshCw className="h-4 w-4" /> Refill requested
      </span>
    );
  }

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 text-label-md font-medium text-success-fg">
        <Check className="h-4 w-4" /> Refill requested — we’ve notified the clinic
      </span>
    );
  }

  if (state === 'draft' || state === 'busy' || state === 'error') {
    return (
      <div className="flex w-full flex-col gap-3 rounded-lg border border-line bg-canvas p-3">
        <p className="text-label-sm font-medium text-ink">Request Refill</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any notes for the clinic? (Optional)"
          className="w-full rounded-md border border-line bg-surface p-2 text-body-sm focus:border-primary focus:outline-none"
          rows={2}
          disabled={state === 'busy'}
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setState('idle');
              setNote('');
              setMsg(null);
            }}
            disabled={state === 'busy'}
            className="rounded-md px-3 py-1.5 text-label-sm font-medium text-ink-soft hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={request}
            disabled={state === 'busy'}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-label-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {state === 'busy' && <RefreshCw className="h-3 w-3 animate-spin" />}
            Submit Request
          </button>
        </div>
        {msg && <span className="text-label-sm text-danger-fg">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setState('draft')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-label-md font-medium text-primary hover:bg-canvas"
      >
        <RefreshCw className="h-4 w-4" /> Request refill
      </button>
    </div>
  );
}
