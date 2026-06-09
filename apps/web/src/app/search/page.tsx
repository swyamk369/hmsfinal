'use client';

import { useEffect, useState } from 'react';
import { Search as SearchIcon, Construction } from 'lucide-react';
import Protected from '@/components/Protected';
import { PageHeader, Card, EmptyState } from '@/components/ui';

function SearchInner() {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQ(new URLSearchParams(window.location.search).get('q') ?? '');
    }
  }, []);

  return (
    <>
      <PageHeader title="Search" subtitle={q ? `Query: “${q}”` : 'Find patients, bills, appointments, and orders'} />
      <Card>
        <EmptyState
          icon={Construction}
          title="Global search is not available yet"
          hint="Cross-module search (patients, bills, appointments, lab orders) is planned for a later phase. Until then, use the search box on each module's page."
        />
      </Card>
      <p className="mt-4 flex items-center gap-2 text-body-sm text-ink-soft">
        <SearchIcon className="h-4 w-4" />
        This is an intentional placeholder — it does not return mock results.
      </p>
    </>
  );
}

export default function SearchPage() {
  return (
    <Protected>
      <SearchInner />
    </Protected>
  );
}
