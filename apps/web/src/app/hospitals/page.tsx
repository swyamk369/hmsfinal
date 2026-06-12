'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, MapPin, Video, CalendarCheck } from 'lucide-react';
import { PublicShell, SearchBar } from '@/components/public-shell';
import {
  Avatar,
  CheckRow,
  FilterGroup,
  Pagination,
  ResultsLayout,
  SortSelect,
  Tag,
  Toggle,
} from '@/components/patient/directory-ui';
import { SaveHospitalButton } from '@/components/patient/save-button';
import { publicApi, type SearchRow } from '@/lib/public';

const PAGE_SIZE = 8;

function tally(rows: SearchRow[], pick: (r: SearchRow) => (string | null)[]): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const v of pick(r)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function HospitalsInner() {
  const params = useSearchParams();
  const [all, setAll] = useState<SearchRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [cities, setCities] = useState<Set<string>>(new Set());
  const [services, setServices] = useState<Set<string>>(new Set());
  const [telehealthOnly, setTelehealthOnly] = useState(false);
  const [bookableOnly, setBookableOnly] = useState(false);
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (params.get('q')) setQ(params.get('q')!);
    const city = params.get('city');
    if (city) setCities(new Set([city]));
  }, [params]);

  const load = useCallback(async () => {
    setErr(null);
    setAll(null);
    try {
      setAll(await publicApi.hospitals());
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSet = (set: Set<string>, setter: (s: Set<string>) => void, value: string, on: boolean) => {
    const next = new Set(set);
    on ? next.add(value) : next.delete(value);
    setter(next);
    setPage(1);
  };

  const textFiltered = useMemo(() => {
    const rows = all ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.hospitalName, r.location, ...(r.services ?? [])].filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }, [all, q]);

  const cityCounts = useMemo(() => tally(textFiltered, (r) => [r.city]), [textFiltered]);
  const serviceCounts = useMemo(() => tally(textFiltered, (r) => r.services ?? []), [textFiltered]);

  const filtered = useMemo(() => {
    let rows = textFiltered;
    if (cities.size) rows = rows.filter((r) => r.city && cities.has(r.city));
    if (services.size) rows = rows.filter((r) => (r.services ?? []).some((s) => services.has(s)));
    if (telehealthOnly) rows = rows.filter((r) => (r.consultationTypes ?? []).includes('TELEHEALTH'));
    if (bookableOnly) rows = rows.filter((r) => r.isBookable);
    const sorted = [...rows];
    if (sort === 'name') sorted.sort((a, b) => a.hospitalName.localeCompare(b.hospitalName));
    return sorted;
  }, [textFiltered, cities, services, telehealthOnly, bookableOnly, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters = cities.size + services.size + (telehealthOnly ? 1 : 0) + (bookableOnly ? 1 : 0);

  const clearAll = () => {
    setCities(new Set());
    setServices(new Set());
    setTelehealthOnly(false);
    setBookableOnly(false);
    setPage(1);
  };

  const filters = (
    <>
      <FilterGroup title="Availability">
        <Toggle checked={telehealthOnly} onChange={setTelehealthOnly} label="Telehealth" />
        <Toggle checked={bookableOnly} onChange={setBookableOnly} label="Online booking" />
      </FilterGroup>
      {cityCounts.length > 0 && (
        <FilterGroup title="City">
          {cityCounts.map((c) => (
            <CheckRow
              key={c.value}
              checked={cities.has(c.value)}
              onChange={(on) => toggleSet(cities, setCities, c.value, on)}
              label={c.value}
              count={c.count}
            />
          ))}
        </FilterGroup>
      )}
      {serviceCounts.length > 0 && (
        <FilterGroup title="Services">
          <div className="max-h-56 overflow-y-auto pr-1">
            {serviceCounts.map((s) => (
              <CheckRow
                key={s.value}
                checked={services.has(s.value)}
                onChange={(on) => toggleSet(services, setServices, s.value, on)}
                label={s.value}
                count={s.count}
              />
            ))}
          </div>
        </FilterGroup>
      )}
    </>
  );

  return (
    <PublicShell>
      <div className="mb-5">
        <h1 className="text-headline-md font-semibold text-ink">Find a hospital or clinic</h1>
        <p className="mt-1 text-body-md text-ink-muted">
          Browse hospitals and clinics, then book an appointment online.
        </p>
      </div>
      <div className="mb-6">
        <SearchBar
          value={q}
          onChange={setQ}
          onSubmit={() => setPage(1)}
          placeholder="Hospital name, city, or service…"
        />
      </div>

      {err && (
        <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">
          {err}
        </div>
      )}
      {!all && !err && <p className="py-10 text-center text-body-sm text-ink-soft">Loading hospitals…</p>}

      {all && !err && (
        <ResultsLayout filters={filters} activeCount={activeFilters} onClearFilters={clearAll}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-md text-ink">
              <span className="font-semibold">{filtered.length}</span> {filtered.length === 1 ? 'result' : 'results'}{' '}
              found
            </p>
            <SortSelect value={sort} onChange={setSort} options={[{ value: 'name', label: 'Name' }]} />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-ink-soft" />
              <p className="font-medium text-ink">No hospitals match your filters</p>
              <p className="mt-1 text-body-sm text-ink-muted">Try clearing filters or a different search term.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pageRows.map((h) => (
                <article
                  key={h.id}
                  className="relative flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:flex-row"
                >
                  <div className="flex flex-grow gap-4">
                    <Avatar name={h.hospitalName} url={h.logoUrl} shape="square" />
                    <div className="min-w-0">
                      <Link
                        href={`/hospitals/${h.hospitalSlug}`}
                        className="text-title-lg font-semibold text-ink hover:text-primary"
                      >
                        {h.hospitalName}
                      </Link>
                      {h.location && (
                        <div className="mt-1 flex items-center gap-1 text-body-sm text-ink-muted">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" /> {h.location}
                        </div>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {(h.services ?? []).slice(0, 4).map((s) => (
                          <Tag key={s}>{s}</Tag>
                        ))}
                        {(h.consultationTypes ?? []).includes('TELEHEALTH') && (
                          <Tag>
                            <span className="inline-flex items-center gap-1">
                              <Video className="h-3 w-3" /> Telehealth
                            </span>
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-stretch justify-center gap-2 sm:w-44">
                    <SaveHospitalButton
                      tenantId={h.tenantId}
                      hospitalSlug={h.hospitalSlug}
                      hospitalName={h.hospitalName}
                      city={h.city}
                      logoUrl={h.logoUrl}
                      className="absolute right-3 top-3"
                    />
                    {h.isBookable && (
                      <div className="flex items-center justify-center gap-1 text-label-sm font-medium text-success-fg">
                        <CalendarCheck className="h-3.5 w-3.5" /> Online booking
                      </div>
                    )}
                    <Link
                      href={`/hospitals/${h.hospitalSlug}`}
                      className="rounded-lg border border-line px-4 py-2 text-center text-label-md font-medium text-ink hover:bg-canvas"
                    >
                      View profile
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          <Pagination page={page} pageCount={pageCount} onPage={setPage} />
        </ResultsLayout>
      )}
    </PublicShell>
  );
}

export default function HospitalsPage() {
  return (
    <Suspense
      fallback={
        <PublicShell>
          <p className="py-10 text-center text-body-sm text-ink-soft">Loading…</p>
        </PublicShell>
      }
    >
      <HospitalsInner />
    </Suspense>
  );
}
