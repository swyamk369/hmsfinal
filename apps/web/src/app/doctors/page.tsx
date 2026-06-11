'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Stethoscope, Building2, CalendarCheck, Video } from 'lucide-react';
import { PublicShell, SearchBar } from '@/components/public-shell';
import { publicApi, type SearchRow } from '@/lib/public';

export default function DoctorsPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (query?: string) => {
    setErr(null);
    setRows(null);
    try {
      setRows(await publicApi.doctors(query));
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
        <h1 className="text-display-sm font-semibold text-ink">Find a doctor</h1>
        <p className="mt-1 text-body-md text-ink-muted">Search by name, specialty, or hospital — and book online.</p>
      </div>
      <div className="mb-6">
        <SearchBar value={q} onChange={setQ} onSubmit={() => load(q)} placeholder="Doctor name, specialty, or hospital…" />
      </div>

      {err && <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{err}</div>}
      {!rows && !err && <p className="py-10 text-center text-body-sm text-ink-soft">Loading doctors…</p>}
      {rows && rows.length === 0 && (
        <div className="rounded-lg border border-line bg-surface px-6 py-12 text-center">
          <Stethoscope className="mx-auto mb-3 h-8 w-8 text-ink-soft" />
          <p className="font-medium text-ink">No doctors found</p>
          <p className="mt-1 text-body-sm text-ink-muted">Try a different name, specialty, or hospital.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(rows ?? []).map((d) => (
          <Link
            key={d.id}
            href={`/doctors/${d.doctorSlug}`}
            className="group flex gap-3 rounded-xl border border-line bg-surface p-5 transition hover:border-primary hover:shadow-raised"
          >
            <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-primary-100 text-primary-700">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-ink group-hover:text-primary">{d.doctorName}</div>
              {d.specialty && <div className="text-body-sm text-ink-muted">{d.specialty}</div>}
              <div className="mt-1 flex items-center gap-1 text-label-sm text-ink-soft">
                <Building2 className="h-3.5 w-3.5" /> {d.hospitalName}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {d.consultationTypes?.includes('TELEHEALTH') && (
                  <span className="inline-flex items-center gap-1 text-label-sm text-ink-muted">
                    <Video className="h-3.5 w-3.5" /> Telehealth
                  </span>
                )}
                {d.isBookable && (
                  <span className="inline-flex items-center gap-1 text-label-sm font-medium text-success-fg">
                    <CalendarCheck className="h-3.5 w-3.5" /> Bookable
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
