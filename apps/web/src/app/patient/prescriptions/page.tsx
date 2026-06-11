'use client';

import { useState } from 'react';
import { Pill } from 'lucide-react';
import { usePortal } from '@/components/patient/portal-shell';
import { useData, Loading, ErrorState, EmptyState, StatusBadge, SubTabs } from '@/components/patient/portal-ui';
import { portalApi, type PortalPrescription } from '@/lib/patient-portal';

type Filter = 'active' | 'completed' | 'all';
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
  const { data, err } = useData<PortalPrescription[]>(() => portalApi.prescriptions(tenantId), [tenantId]);
  if (err) return <ErrorState msg={err} />;
  if (!data) return <Loading label="Loading prescriptions…" />;

  const active = data.filter((p) => ACTIVE.includes(p.status.toUpperCase()));
  const completed = data.filter((p) => !ACTIVE.includes(p.status.toUpperCase()));
  const rows = tab === 'active' ? active : tab === 'completed' ? completed : data;

  return (
    <div>
      <SubTabs<Filter>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'active', label: 'Active', count: active.length },
          { key: 'completed', label: 'Completed', count: completed.length },
          { key: 'all', label: 'All', count: data.length },
        ]}
      />
      {rows.length === 0 ? (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
