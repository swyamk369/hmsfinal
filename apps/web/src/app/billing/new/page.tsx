'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Search, Receipt } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { patientsApi, type Patient } from '@/lib/patients';
import { billingApi, type CatalogItem } from '@/lib/billing';
import { money, toMinor } from '@/lib/format';
import { Button, Section, FormField, Input, Select, Textarea, PageHeader, ErrorState } from '@/components/ui';

interface Row {
  catalogId?: string;
  name: string;
  quantity: number;
  unitPrice: number; // minor
}

function NewBillInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const toast = useToast();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [discountStr, setDiscountStr] = useState('0');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (t)
      billingApi
        .catalog(t)
        .then(setCatalog)
        .catch((e) => setErr((e as Error).message));
  }, [t]);

  const subtotal = rows.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const discount = Math.min(toMinor(discountStr) ?? 0, subtotal);
  const net = subtotal - discount;

  function addCatalog(id: string) {
    const item = catalog.find((c) => c.id === id);
    if (!item) return;
    setRows((r) => [...r, { catalogId: item.id, name: item.name, quantity: 1, unitPrice: item.price }]);
  }
  function addManual() {
    setRows((r) => [...r, { name: '', quantity: 1, unitPrice: 0 }]);
  }
  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function create() {
    if (!patient || rows.length === 0) return;
    if (rows.some((r) => !r.name.trim())) {
      toast.error('Every line item needs a name.');
      return;
    }
    setBusy(true);
    try {
      const bill = await billingApi.create(t, {
        patientId: patient.id,
        discount,
        notes: notes.trim() || undefined,
        items: rows.map((r) => ({
          catalogId: r.catalogId,
          name: r.name.trim(),
          quantity: r.quantity,
          unitPrice: r.unitPrice,
        })),
      });
      toast.success(`Bill ${bill.billNumber} created.`);
      router.push(`/billing/${bill.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        href="/billing"
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to billing
      </Link>
      <PageHeader title="Create New Bill" subtitle="Add patient charges for services rendered" />
      {err && <ErrorState message={err} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Patient">
            <div className="p-5">
              <PatientPicker value={patient} onChange={setPatient} />
            </div>
          </Section>

          <Section
            title="Line items"
            action={
              <div className="flex items-center gap-2">
                <Select
                  className="w-52"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addCatalog(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">+ Add from catalog…</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {money(c.price)}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="ghost" icon={Plus} onClick={addManual}>
                  Manual
                </Button>
              </div>
            }
          >
            {rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-body-sm text-ink-soft">
                Add a service from the catalog or a manual line.
              </p>
            ) : (
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-line text-label-md uppercase text-ink-soft">
                    <th className="px-5 py-2 font-medium">Service</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Unit price</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2">
                        <Input
                          value={r.name}
                          onChange={(e) => update(i, { name: e.target.value })}
                          placeholder="Service name"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="w-16"
                          inputMode="numeric"
                          value={String(r.quantity)}
                          onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="w-24"
                          inputMode="decimal"
                          value={(r.unitPrice / 100).toString()}
                          onChange={(e) => update(i, { unitPrice: toMinor(e.target.value) ?? 0 })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-ink">{money(r.quantity * r.unitPrice)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
                          className="rounded p-1 text-ink-soft hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Notes">
            <div className="p-5">
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes / justification…"
              />
            </div>
          </Section>
        </div>

        {/* Summary */}
        <div>
          <Section title="Bill summary">
            <div className="space-y-3 px-5 py-4 text-body-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">Subtotal</span>
                <span className="text-ink">{money(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">Discount</span>
                <Input
                  className="w-28 text-right"
                  inputMode="decimal"
                  value={discountStr}
                  onChange={(e) => setDiscountStr(e.target.value)}
                />
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-title-lg">
                <span className="text-ink">Net amount</span>
                <span className="text-ink">{money(net)}</span>
              </div>
              <Button
                className="w-full"
                icon={Receipt}
                onClick={create}
                loading={busy}
                disabled={!patient || rows.length === 0}
              >
                Generate bill
              </Button>
              <p className="text-center text-label-sm text-ink-soft">Assigns an invoice number.</p>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function PatientPicker({ value, onChange }: { value: Patient | null; onChange: (p: Patient | null) => void }) {
  const { activeTenantId } = useAuth();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Patient[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTenantId) return;
    setResults(await patientsApi.list(activeTenantId, term.trim()));
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-line bg-canvas px-3 py-2 text-body-sm">
        <span>
          <span className="font-medium text-ink">{value.fullName}</span>{' '}
          <span className="text-ink-soft">· {value.mrn}</span>
        </span>
        <button type="button" className="text-label-sm text-primary hover:underline" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div>
      <form onSubmit={search} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <Input
          className="pl-8"
          placeholder="Search patient by name/MRN…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </form>
      {results && (
        <ul className="mt-2 max-h-40 divide-y divide-line overflow-y-auto rounded-md border border-line">
          {results.length === 0 && <li className="px-3 py-2 text-label-sm text-ink-soft">No match</li>}
          {results.slice(0, 6).map((p) => (
            <li
              key={p.id}
              onClick={() => onChange(p)}
              className="cursor-pointer px-3 py-2 text-body-sm hover:bg-canvas"
            >
              <span className="font-medium text-ink">{p.fullName}</span>{' '}
              <span className="text-ink-soft">· {p.mrn}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NewBillPage() {
  return (
    <Protected requireModule="BILLING" allowedRoles={['BILLING', 'RECEPTION', 'HOSPITAL_ADMIN']}>
      <NewBillInner />
    </Protected>
  );
}
