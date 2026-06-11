'use client';

import { useState } from 'react';
import { Receipt, Info } from 'lucide-react';
import { usePortal } from '@/components/patient/portal-shell';
import { useData, Loading, ErrorState, EmptyState, StatusBadge, SubTabs, portalMoney } from '@/components/patient/portal-ui';
import { portalApi, type PortalBill } from '@/lib/patient-portal';

type Filter = 'unpaid' | 'paid' | 'all';

export default function BillsPage() {
  const { tenantId, openLinkModal } = usePortal();
  const [tab, setTab] = useState<Filter>('unpaid');

  if (!tenantId)
    return (
      <EmptyState
        icon={Receipt}
        title="Link a hospital to see bills"
        body="Your bills appear once you've linked a hospital record."
        action={<button onClick={openLinkModal} className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">Link a record</button>}
      />
    );
  return <BillsInner tenantId={tenantId} tab={tab} setTab={setTab} />;
}

function BillsInner({ tenantId, tab, setTab }: { tenantId: string; tab: Filter; setTab: (f: Filter) => void }) {
  const { data, err } = useData<PortalBill[]>(() => portalApi.bills(tenantId), [tenantId]);
  if (err) return <ErrorState msg={err} />;
  if (!data) return <Loading label="Loading bills…" />;

  const unpaid = data.filter((b) => b.due > 0);
  const paid = data.filter((b) => b.due <= 0);
  const rows = tab === 'unpaid' ? unpaid : tab === 'paid' ? paid : data;

  return (
    <div>
      <SubTabs<Filter>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'unpaid', label: 'Unpaid', count: unpaid.length },
          { key: 'paid', label: 'Paid', count: paid.length },
          { key: 'all', label: 'All', count: data.length },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title={`No ${tab === 'all' ? '' : tab + ' '}bills`} body="Bills raised by your hospital appear here." />
      ) : (
        <div className="space-y-2">
          {rows.map((b) => (
            <div key={b.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-body-sm text-ink">{b.billNumber}</span>
                <StatusBadge status={b.due > 0 ? (b.paid > 0 ? 'PARTIAL' : 'UNPAID') : 'PAID'} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-body-sm">
                <span className="text-ink-muted">Total <span className="font-semibold text-ink">{portalMoney(b.netAmount)}</span></span>
                <span className="text-ink-muted">Paid <span className="font-medium text-ink">{portalMoney(b.paid)}</span></span>
                <span className="text-ink-muted">Due <span className={`font-semibold ${b.due > 0 ? 'text-danger-fg' : 'text-ink'}`}>{portalMoney(b.due)}</span></span>
              </div>
              {b.items.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-line pt-3 text-body-sm text-ink-muted">
                  {b.items.slice(0, 4).map((it, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}</span>
                      <span className="text-ink">{portalMoney(it.total)}</span>
                    </li>
                  ))}
                  {b.items.length > 4 && <li className="text-ink-soft">+{b.items.length - 4} more…</li>}
                </ul>
              )}
              {b.due > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-canvas px-3 py-2 text-body-sm text-ink-muted">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-soft" />
                  Online payment isn't available yet — please pay at the clinic or contact the hospital to settle this bill.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
