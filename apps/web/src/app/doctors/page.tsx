'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Stethoscope, Building2, Video, User, CalendarCheck, Globe } from 'lucide-react';
import { PublicShell, SearchBar } from '@/components/public-shell';
import { Avatar, CheckRow, FilterGroup, Pagination, ResultsLayout, SortSelect, Tag, Toggle } from '@/components/patient/directory-ui';
import { publicApi, type SearchRow } from '@/lib/public';

const PAGE_SIZE = 8;

function tally(rows: SearchRow[], pick: (r: SearchRow) => (string | null)[]): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) for (const v of pick(r)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function DoctorsInner() {
  const params = useSearchParams();
  const [all, setAll] = useState<SearchRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [specialties, setSpecialties] = useState<Set<string>>(new Set());
  const [languages, setLanguages] = useState<Set<string>>(new Set());
  const [telehealthOnly, setTelehealthOnly] = useState(false);
  const [bookableOnly, setBookableOnly] = useState(false);
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  // Seed filters from the home-page query (?q, ?city, ?specialty).
  useEffect(() => {
    const seedQ = [params.get('q'), params.get('city')].filter(Boolean).join(' ');
    if (seedQ) setQ(seedQ);
    const sp = params.get('specialty');
    if (sp) setSpecialties(new Set([sp]));
  }, [params]);

  const load = useCallback(async () => {
    setErr(null);
    setAll(null);
    try {
      setAll(await publicApi.doctors());
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
      [r.doctorName, r.specialty, r.hospitalName, ...(r.services ?? [])].filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }, [all, q]);

  const specialtyCounts = useMemo(() => tally(textFiltered, (r) => [r.specialty]), [textFiltered]);
  const languageCounts = useMemo(() => tally(textFiltered, (r) => r.languages ?? []), [textFiltered]);

  const filtered = useMemo(() => {
    let rows = textFiltered;
    if (specialties.size) rows = rows.filter((r) => r.specialty && specialties.has(r.specialty));
    if (languages.size) rows = rows.filter((r) => (r.languages ?? []).some((l) => languages.has(l)));
    if (telehealthOnly) rows = rows.filter((r) => (r.consultationTypes ?? []).includes('TELEHEALTH'));
    if (bookableOnly) rows = rows.filter((r) => r.isBookable);
    const sorted = [...rows];
    if (sort === 'name') sorted.sort((a, b) => (a.doctorName ?? '').localeCompare(b.doctorName ?? ''));
    if (sort === 'specialty') sorted.sort((a, b) => (a.specialty ?? '').localeCompare(b.specialty ?? ''));
    return sorted;
  }, [textFiltered, specialties, languages, telehealthOnly, bookableOnly, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters = specialties.size + languages.size + (telehealthOnly ? 1 : 0) + (bookableOnly ? 1 : 0);

  const clearAll = () => {
    setSpecialties(new Set());
    setLanguages(new Set());
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
      {specialtyCounts.length > 0 && (
        <FilterGroup title="Specialty">
          <div className="max-h-56 overflow-y-auto pr-1">
            {specialtyCounts.map((s) => (
              <CheckRow
                key={s.value}
                checked={specialties.has(s.value)}
                onChange={(on) => toggleSet(specialties, setSpecialties, s.value, on)}
                label={s.value}
                count={s.count}
              />
            ))}
          </div>
        </FilterGroup>
      )}
      {languageCounts.length > 0 && (
        <FilterGroup title="Language">
          {languageCounts.map((l) => (
            <CheckRow
              key={l.value}
              checked={languages.has(l.value)}
              onChange={(on) => toggleSet(languages, setLanguages, l.value, on)}
              label={l.value}
              count={l.count}
            />
          ))}
        </FilterGroup>
      )}
    </>
  );

  return (
    <PublicShell>
      <div className="mb-5">
        <h1 className="text-headline-md font-semibold text-ink">Find a doctor</h1>
        <p className="mt-1 text-body-md text-ink-muted">Search by name, specialty, or hospital — and book online.</p>
      </div>
      <div className="mb-6">
        <SearchBar value={q} onChange={setQ} onSubmit={() => setPage(1)} placeholder="Doctor name, specialty, or hospital…" />
      </div>

      {err && <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{err}</div>}
      {!all && !err && <p className="py-10 text-center text-body-sm text-ink-soft">Loading doctors…</p>}

      {all && !err && (
        <ResultsLayout filters={filters} activeCount={activeFilters} onClearFilters={clearAll}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-md text-ink">
              <span className="font-semibold">{filtered.length}</span> {filtered.length === 1 ? 'doctor' : 'doctors'} found
            </p>
            <SortSelect
              value={sort}
              onChange={setSort}
              options={[
                { value: 'name', label: 'Name' },
                { value: 'specialty', label: 'Specialty' },
              ]}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
              <Stethoscope className="mx-auto mb-3 h-8 w-8 text-ink-soft" />
              <p className="font-medium text-ink">No doctors match your filters</p>
              <p className="mt-1 text-body-sm text-ink-muted">Try clearing filters or a different search term.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pageRows.map((d) => (
                <article key={d.id} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:flex-row">
                  <div className="flex flex-grow gap-4">
                    <Avatar name={d.doctorName ?? 'Doctor'} url={d.photoUrl} />
                    <div className="min-w-0">
                      <Link href={`/doctors/${d.doctorSlug}`} className="text-title-lg font-semibold text-ink hover:text-primary">
                        {d.doctorName}
                      </Link>
                      {d.specialty && <div className="text-body-md font-medium text-primary">{d.specialty}</div>}
                      <div className="mt-1 flex items-center gap-1 text-body-sm text-ink-muted">
                        <Building2 className="h-3.5 w-3.5 flex-shrink-0" /> {d.hospitalName}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {(d.consultationTypes ?? []).includes('IN_PERSON') && (
                          <Tag>
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" /> In-person
                            </span>
                          </Tag>
                        )}
                        {(d.consultationTypes ?? []).includes('TELEHEALTH') && (
                          <Tag>
                            <span className="inline-flex items-center gap-1">
                              <Video className="h-3 w-3" /> Telehealth
                            </span>
                          </Tag>
                        )}
                        {(d.languages ?? []).slice(0, 2).map((l) => (
                          <Tag key={l}>
                            <span className="inline-flex items-center gap-1">
                              <Globe className="h-3 w-3" /> {l}
                            </span>
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-stretch justify-center gap-2 sm:w-44">
                    {d.isBookable && (
                      <div className="flex items-center justify-center gap-1 text-label-sm font-medium text-success-fg">
                        <CalendarCheck className="h-3.5 w-3.5" /> Online booking
                      </div>
                    )}
                    {d.isBookable && d.doctorId ? (
                      <Link
                        href={`/book/${d.tenantId}/${d.doctorId}`}
                        className="rounded-lg bg-primary px-4 py-2 text-center text-label-md font-medium text-white hover:bg-primary-700"
                      >
                        Book appointment
                      </Link>
                    ) : null}
                    <Link
                      href={`/doctors/${d.doctorSlug}`}
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

export default function DoctorsPage() {
  return (
    <Suspense fallback={<PublicShell><p className="py-10 text-center text-body-sm text-ink-soft">Loading…</p></PublicShell>}>
      <DoctorsInner />
    </Suspense>
  );
}
