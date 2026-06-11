'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, MapPin, CalendarCheck } from 'lucide-react';
import { PublicShell, SearchBar } from '@/components/public-shell';
import { publicApi, type SearchRow } from '@/lib/public';

export default function HospitalsPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (query?: string) => {
    setErr(null);
    setRows(null);
    try {
      setRows(await publicApi.hospitals(query));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PublicShell>
      <div className="mb-6">
        <h1 className="text-display-sm font-semibold text-ink">Find a hospital or clinic</h1>
        <p className="mt-1 text-body-md text-ink-muted">Search hospitals near you and book an appointment online.</p>
      </div>
      <div className="mb-6">
        <SearchBar value={q} onChange={setQ} onSubmit={() => load(q)} placeholder="Hospital name, city, or specialty…" />
      </div>

      {err && <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{err}</div>}
      {!rows && !err && <p className="py-10 text-center text-body-sm text-ink-soft">Loading hospitals…</p>}
      {rows && rows.length === 0 && (
        <div className="rounded-lg border border-line bg-surface px-6 py-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-ink-soft" />
          <p className="font-medium text-ink">No hospitals found</p>
          <p className="mt-1 text-body-sm text-ink-muted">Try a different name, city, or specialty.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(rows ?? []).map((h) => (
          <Link
            key={h.id}
            href={`/hospitals/${h.hospitalSlug}`}
            className="group rounded-xl border border-line bg-surface p-5 transition hover:border-primary hover:shadow-raised"
          >
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-primary-100 text-primary-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="font-semibold text-ink group-hover:text-primary">{h.hospitalName}</div>
            {h.location && (
              <div className="mt-1 flex items-center gap-1 text-body-sm text-ink-muted">
                <MapPin className="h-3.5 w-3.5" /> {h.location}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {h.services.slice(0, 4).map((s) => (
                <span key={s} className="rounded-full bg-canvas px-2 py-0.5 text-label-sm text-ink-muted">
                  {s}
                </span>
              ))}
            </div>
            {h.isBookable && (
              <div className="mt-3 inline-flex items-center gap-1 text-label-sm font-medium text-success-fg">
                <CalendarCheck className="h-3.5 w-3.5" /> Online booking available
              </div>
            )}
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
