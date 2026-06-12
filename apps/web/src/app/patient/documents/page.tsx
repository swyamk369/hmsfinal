'use client';

import { useMemo, useState } from 'react';
import { FileText, Search, ShieldCheck } from 'lucide-react';
import { usePortal } from '@/components/patient/portal-shell';
import { useData, Loading, ErrorState, EmptyState, SubTabs } from '@/components/patient/portal-ui';
import { portalApi, type PortalDocument } from '@/lib/patient-portal';

type Filter = 'all' | 'reports' | 'prescriptions' | 'bills' | 'referrals';
const MATCH: Record<Exclude<Filter, 'all'>, string[]> = {
  reports: ['report', 'lab', 'result', 'radiology', 'scan'],
  prescriptions: ['prescription', 'rx', 'medication'],
  bills: ['bill', 'invoice', 'receipt', 'payment'],
  referrals: ['referral', 'refer'],
};

export default function DocumentsPage() {
  const { tenantId, openLinkModal } = usePortal();
  const [tab, setTab] = useState<Filter>('all');
  const [q, setQ] = useState('');

  if (!tenantId)
    return (
      <EmptyState
        icon={FileText}
        title="Link a hospital to see documents"
        body="Reports and documents your hospital shares appear once you've linked a record."
        action={
          <button
            onClick={openLinkModal}
            className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90"
          >
            Link a record
          </button>
        }
      />
    );
  return <Inner tenantId={tenantId} tab={tab} setTab={setTab} q={q} setQ={setQ} />;
}

function Inner({
  tenantId,
  tab,
  setTab,
  q,
  setQ,
}: {
  tenantId: string;
  tab: Filter;
  setTab: (f: Filter) => void;
  q: string;
  setQ: (s: string) => void;
}) {
  const { data, err } = useData<PortalDocument[]>(() => portalApi.documents(tenantId), [tenantId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.filter((d) => {
      const cat = (d.category || '').toLowerCase();
      const inTab = tab === 'all' || MATCH[tab].some((k) => cat.includes(k));
      const inSearch = !needle || d.title.toLowerCase().includes(needle) || cat.includes(needle);
      return inTab && inSearch;
    });
  }, [data, tab, q]);

  if (err) return <ErrorState msg={err} />;
  if (!data) return <Loading label="Loading documents…" />;

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-body-sm text-primary-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
        Only documents a hospital has chosen to publish to you are shown here. They cannot be edited or deleted from the
        portal.
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-body-md text-ink focus:border-primary focus:outline-none"
        />
      </div>

      <SubTabs<Filter>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'reports', label: 'Reports' },
          { key: 'prescriptions', label: 'Prescriptions' },
          { key: 'bills', label: 'Bills' },
          { key: 'referrals', label: 'Referrals' },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          body={
            data.length === 0
              ? 'Documents appear here when a hospital shares them with you.'
              : 'No documents match this filter.'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <a
              key={d.id}
              href={d.documentUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => void portalApi.markDocumentViewed(tenantId, d.id).catch(() => {})}
              className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 hover:border-primary"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-50 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium text-ink">{d.title}</div>
                  <div className="text-label-sm text-ink-soft">
                    {d.category || 'Document'} · {new Date(d.publishedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <span className="text-body-sm font-medium text-primary">View</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
