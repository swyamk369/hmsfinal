'use client';

import type React from 'react';
import Link from 'next/link';
import { Download, ArrowRight, type LucideIcon } from 'lucide-react';
import { Button, Section, StatCard, Badge, EmptyState } from '@/components/ui';
import { downloadCsv, pairs } from '@/lib/reports';
import { formatDateTime, money } from '@/lib/format';

export function KpiGrid({ items }: { items: { label: string; value: React.ReactNode; hint?: string; icon?: LucideIcon }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} hint={item.hint} icon={item.icon} />
      ))}
    </div>
  );
}

export function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = pairs(data);
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-body-sm text-ink-soft">No data in this range.</p>
      ) : (
        <div className="space-y-3 p-5">
          {rows.map((row) => {
            const max = Math.max(...rows.map((r) => r.value), 1);
            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-body-sm">
                  <span className="font-medium text-ink">{row.label.replace(/_/g, ' ')}</span>
                  <span className="text-ink-muted">{row.value}</span>
                </div>
                <div className="h-2 rounded-full bg-canvas">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(8, (row.value / max) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export function ReportTable({
  title,
  rows,
  columns,
  filename,
  empty = 'No rows in this range.',
}: {
  title: string;
  rows: Record<string, any>[];
  columns: { key: string; label: string; money?: boolean; date?: boolean }[];
  filename: string;
  empty?: string;
}) {
  return (
    <Section
      title={title}
      action={
        <Button size="sm" variant="ghost" icon={Download} onClick={() => downloadCsv(filename, rows)} disabled={rows.length === 0}>
          CSV
        </Button>
      }
    >
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title={empty} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                {columns.map((col) => (
                  <th key={col.key} className={`px-5 py-3 font-medium ${col.money ? 'text-right' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, i) => (
                <tr key={row.id ?? `${title}-${i}`} className="hover:bg-canvas">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-5 py-3 ${col.money ? 'text-right font-medium text-ink' : 'text-ink-muted'}`}>
                      {col.money ? money(Number(row[col.key] ?? 0)) : col.date ? formatDateTime(row[col.key]) : String(row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function ModuleCard({
  title,
  value,
  href,
  badge,
  hint,
}: {
  title: string;
  value: React.ReactNode;
  href: string;
  badge?: string;
  hint?: string;
}) {
  return (
    <Link href={href} className="card block p-4 hover:border-primary/50 hover:shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-label-md uppercase text-ink-muted">{title}</div>
          <div className="mt-2 text-headline-md text-ink">{value}</div>
          {hint && <div className="mt-1 text-body-sm text-ink-soft">{hint}</div>}
        </div>
        {badge && <Badge tone="primary">{badge}</Badge>}
      </div>
      <div className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-primary">
        Open <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
