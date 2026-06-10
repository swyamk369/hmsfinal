'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Wallet } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { patientsApi, type Patient } from '@/lib/patients';
import { Button, EmptyState, ErrorState, Input, PageHeader, Section, Spinner } from '@/components/ui';
import { FinanceShell } from '../finance-ui';

/**
 * Patient accounts index: find a patient, open their full financial account
 * (bills, payments, refunds, pending charges, claims). Deep links from bills
 * and receivables land on /finance/patient-accounts/[patientId] directly.
 */
function PatientAccountsIndexInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Patient[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setRows(await patientsApi.list(t, q.trim() || undefined));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [q, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Patient accounts" subtitle="Search a patient to open their complete financial account" />
      <FinanceShell>
        <Section>
          <div className="mb-4 flex items-end gap-3">
            <div className="w-80">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, MRN, or phone"
                onKeyDown={(e) => e.key === 'Enter' && void load()}
              />
            </div>
            <Button icon={Search} onClick={() => void load()}>
              Search
            </Button>
          </div>

          {err ? (
            <ErrorState message={err} />
          ) : rows === null ? (
            <Spinner label="Loading patients…" />
          ) : rows.length === 0 ? (
            <EmptyState icon={Wallet} title="No patients found" hint="Try a different name, MRN, or phone number." />
          ) : (
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">MRN</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-2.5 font-medium text-ink">{p.fullName}</td>
                    <td className="px-4 py-2.5 font-mono text-[13px] text-ink-muted">{p.mrn}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{p.phone ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/finance/patient-accounts/${p.id}`} className="font-medium text-primary hover:underline">
                        Open account
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </FinanceShell>
    </>
  );
}

export default function PatientAccountsIndexPage() {
  return (
    <Protected requireModule="BILLING" requirePermission={['finance.patient_account.read', 'bill.read']}>
      <PatientAccountsIndexInner />
    </Protected>
  );
}
