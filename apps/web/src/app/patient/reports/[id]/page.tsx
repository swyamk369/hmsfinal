'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FlaskConical, AlertTriangle } from 'lucide-react';
import { portalApi, type ReportDetail } from '@/lib/patient-portal';
import { usePortal } from '@/components/patient/portal-shell';
import { Loading, EmptyState, ErrorState, StatusBadge } from '@/components/patient/portal-ui';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenantId, current } = usePortal();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setErr(null);
    try {
      setReport(await portalApi.reportDetail(tenantId, id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [tenantId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState msg={err} />;
  if (!report) return <Loading label="Loading report…" />;

  const hasResults = report.tests.some((t) => t.results.length > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/patient/documents" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to documents
      </Link>

      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="mb-5 flex items-start justify-between border-b border-line pb-4">
          <div>
            <h1 className="flex items-center gap-2 text-headline-md text-ink"><FlaskConical className="h-6 w-6 text-primary" /> Lab report</h1>
            <p className="mt-1 text-body-sm text-ink-muted">
              {current?.hospitalName ?? 'Hospital'} · {new Date(report.createdAt).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={report.status} />
        </div>

        {!hasResults ? (
          <EmptyState icon={AlertTriangle} title="No verified results yet" body="Results will appear here once the lab has verified them." />
        ) : (
          <div className="space-y-6">
            {report.tests.map((t, i) => (
              <div key={i}>
                <h2 className="mb-2 text-headline-sm text-ink">{t.testName}</h2>
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-left text-body-sm">
                    <thead className="bg-canvas text-label-md uppercase text-ink-soft">
                      <tr>
                        <th className="px-4 py-2 font-medium">Test</th>
                        <th className="px-4 py-2 font-medium">Result</th>
                        <th className="px-4 py-2 font-medium">Reference</th>
                        <th className="px-4 py-2 text-right font-medium">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {t.results.map((r, j) => {
                        const abnormal = r.abnormalFlag !== 'NORMAL';
                        return (
                          <tr key={j} className={abnormal ? 'bg-danger-bg/30' : undefined}>
                            <td className="px-4 py-2.5 text-ink">{r.testName}</td>
                            <td className={`px-4 py-2.5 font-medium ${abnormal ? 'text-danger-fg' : 'text-ink'}`}>
                              {r.value ?? '—'} {r.unit ?? ''}
                            </td>
                            <td className="px-4 py-2.5 text-ink-muted">{r.referenceRange ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right">
                              {abnormal ? <StatusBadge status={r.abnormalFlag} /> : <span className="text-ink-soft">Normal</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 border-t border-line pt-4 text-label-sm text-ink-soft">
          This report is provided by {current?.hospitalName ?? 'your hospital'}. For interpretation, please consult your doctor.
        </p>
      </div>
    </div>
  );
}
