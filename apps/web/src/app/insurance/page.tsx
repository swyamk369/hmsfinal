'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileCheck2, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { getActiveMembership } from '@/lib/access';
import { useToast } from '@/components/toast';
import { patientsApi, type Patient } from '@/lib/patients';
import { money, toMinor, formatDate, formatDateTime } from '@/lib/format';
import { outstanding, type Bill } from '@/lib/billing';
import {
  insuranceApi,
  CLAIM_STATUSES,
  type InsuranceClaim,
  type InsuranceProvider,
  type PatientInsurancePolicy,
} from '@/lib/insurance';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Section,
  Select,
  Spinner,
  StatCard,
  StatusChip,
  Textarea,
} from '@/components/ui';

type Tab = 'claims' | 'policies' | 'bills';

function InsuranceInner() {
  const { activeTenantId, profile } = useAuth();
  const t = activeTenantId!;
  const toast = useToast();
  const perms = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const canPolicy = perms.has('insurance.policy.manage');
  const canClaim = perms.has('insurance.claim.create');

  const [claims, setClaims] = useState<InsuranceClaim[] | null>(null);
  const [policies, setPolicies] = useState<PatientInsurancePolicy[] | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('claims');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [policyOpen, setPolicyOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [prefillBillId, setPrefillBillId] = useState('');

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.q = q.trim();
      const claimParams = { ...params, ...(status ? { status } : {}) };
      const [claimRows, policyRows, billRows, providerRows] = await Promise.all([
        insuranceApi.claims(t, claimParams),
        insuranceApi.policies(t, params),
        insuranceApi.bills(t, params),
        insuranceApi.providers(t),
      ]);
      setClaims(claimRows);
      setPolicies(policyRows);
      setBills(billRows);
      setProviders(providerRows);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const billId = new URLSearchParams(window.location.search).get('billId');
    if (billId) {
      setPrefillBillId(billId);
      setClaimOpen(true);
      setTab('bills');
    }
  }, []);

  const stats = useMemo(() => {
    const rows = claims ?? [];
    return {
      open: rows.filter((c) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED'].includes(c.status)).length,
      submitted: rows.filter((c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW').reduce((s, c) => s + c.claimAmount, 0),
      approved: rows.filter((c) => c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED').reduce((s, c) => s + (c.approvedAmount ?? c.claimAmount), 0),
      settled: rows.filter((c) => c.status === 'SETTLED').reduce((s, c) => s + (c.approvedAmount ?? c.claimAmount), 0),
    };
  }, [claims]);

  return (
    <>
      <PageHeader
        title="Insurance"
        subtitle="Patient policies, bill-linked claims, approvals, settlements, and receivables"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
            {canPolicy && (
              <Button variant="ghost" icon={ShieldCheck} onClick={() => setPolicyOpen(true)}>
                Add policy
              </Button>
            )}
            {canClaim && (
              <Button icon={Plus} onClick={() => setClaimOpen(true)}>
                New claim
              </Button>
            )}
          </div>
        }
      />

      {err && <ErrorState message={err} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open claims" value={stats.open} />
        <StatCard label="Submitted value" value={money(stats.submitted)} />
        <StatCard label="Approved value" value={money(stats.approved)} />
        <StatCard label="Settled value" value={money(stats.settled)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-line bg-surface p-1">
          {(['claims', 'policies', 'bills'] as Tab[]).map((x) => (
            <button
              key={x}
              className={`rounded px-3 py-1.5 text-body-sm font-medium ${tab === x ? 'bg-primary text-white' : 'text-ink-muted hover:text-ink'}`}
              onClick={() => setTab(x)}
            >
              {x[0].toUpperCase() + x.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <Input
              className="w-64 pl-8"
              placeholder="Patient, MRN, bill, policy"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          {tab === 'claims' && (
            <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {CLAIM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {tab === 'claims' && <ClaimsTable claims={claims} />}
      {tab === 'policies' && <PoliciesTable policies={policies} canManage={canPolicy} />}
      {tab === 'bills' && (
        <BillsTable
          bills={bills}
          canClaim={canClaim}
          onClaim={(id) => {
            setPrefillBillId(id);
            setClaimOpen(true);
          }}
        />
      )}

      <PolicyModal
        open={policyOpen}
        providers={providers.filter((p) => p.active)}
        tenantId={t}
        onClose={() => setPolicyOpen(false)}
        onSaved={async () => {
          toast.success('Policy saved.');
          await load();
        }}
      />
      <ClaimModal
        open={claimOpen}
        tenantId={t}
        prefillBillId={prefillBillId}
        bills={bills ?? []}
        policies={policies ?? []}
        onClose={() => {
          setClaimOpen(false);
          setPrefillBillId('');
        }}
        onSaved={async () => {
          toast.success('Claim created.');
          await load();
        }}
      />
    </>
  );
}

function ClaimsTable({ claims }: { claims: InsuranceClaim[] | null }) {
  if (!claims) return <Spinner label="Loading claims…" />;
  if (claims.length === 0) {
    return <EmptyState icon={FileCheck2} title="No claims found" hint="Create a claim from an eligible bill or adjust filters." />;
  }
  return (
    <Section title={`Claims · ${claims.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3 font-medium">Claim</th>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Provider / policy</th>
              <th className="px-5 py-3 text-right font-medium">Claim</th>
              <th className="px-5 py-3 text-right font-medium">Approved</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {claims.map((claim) => (
              <tr key={claim.id} className="hover:bg-canvas">
                <td className="px-5 py-3">
                  <Link href={`/insurance/claims/${claim.id}`} className="font-medium text-primary hover:underline">
                    {claim.bill?.billNumber ?? claim.id.slice(0, 8)}
                  </Link>
                  <div className="text-label-sm text-ink-soft">{formatDateTime(claim.createdAt)}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{claim.bill?.patient?.fullName ?? '—'}</div>
                  <div className="text-label-sm text-ink-soft">{claim.bill?.patient?.mrn ?? '—'}</div>
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {claim.patientPolicy?.provider?.name ?? '—'}
                  <div className="text-label-sm">{claim.patientPolicy?.policyNumber ?? '—'}</div>
                </td>
                <td className="px-5 py-3 text-right font-medium text-ink">{money(claim.claimAmount)}</td>
                <td className="px-5 py-3 text-right text-ink-muted">{claim.approvedAmount ? money(claim.approvedAmount) : '—'}</td>
                <td className="px-5 py-3">
                  <StatusChip status={claim.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function PoliciesTable({ policies, canManage }: { policies: PatientInsurancePolicy[] | null; canManage: boolean }) {
  if (!policies) return <Spinner label="Loading policies…" />;
  if (policies.length === 0) return <EmptyState icon={ShieldCheck} title="No policies found" />;
  return (
    <Section title={`Patient policies · ${policies.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Provider</th>
              <th className="px-5 py-3 font-medium">Policy</th>
              <th className="px-5 py-3 font-medium">Validity</th>
              <th className="px-5 py-3 text-right font-medium">Limit</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {policies.map((policy) => (
              <tr key={policy.id} className="hover:bg-canvas">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{policy.patient?.fullName ?? '—'}</div>
                  <div className="text-label-sm text-ink-soft">{policy.patient?.mrn ?? '—'}</div>
                </td>
                <td className="px-5 py-3 text-ink-muted">{policy.provider?.name ?? '—'}</td>
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{policy.policyNumber}</div>
                  <div className="text-label-sm text-ink-soft">{policy.coverage?.memberId ?? policy.coverage?.planName ?? '—'}</div>
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {formatDate(policy.coverage?.validFrom)} - {formatDate(policy.coverage?.validTo)}
                </td>
                <td className="px-5 py-3 text-right text-ink-muted">
                  {policy.coverage?.coverageLimit ? money(policy.coverage.coverageLimit) : '—'}
                </td>
                <td className="px-5 py-3">
                  <StatusChip status={policy.active ? 'ACTIVE' : 'INACTIVE'} />
                  {canManage && <div className="mt-1 text-label-sm text-ink-soft">{policy._count?.claims ?? 0} claims</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function BillsTable({ bills, canClaim, onClaim }: { bills: Bill[] | null; canClaim: boolean; onClaim: (id: string) => void }) {
  if (!bills) return <Spinner label="Loading eligible bills…" />;
  if (bills.length === 0) return <EmptyState title="No eligible bills" hint="Bills appear here once they are created for insured patients." />;
  return (
    <Section title={`Eligible bills · ${bills.length}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-label-md uppercase text-ink-soft">
              <th className="px-5 py-3 font-medium">Bill</th>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 text-right font-medium">Net</th>
              <th className="px-5 py-3 text-right font-medium">Balance</th>
              <th className="px-5 py-3 font-medium">Claims</th>
              {canClaim && <th className="px-5 py-3 text-right font-medium">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-canvas">
                <td className="px-5 py-3">
                  <Link href={`/billing/${bill.id}`} className="font-medium text-primary hover:underline">
                    {bill.billNumber}
                  </Link>
                  <div className="text-label-sm text-ink-soft">{formatDateTime(bill.createdAt)}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{bill.patient?.fullName ?? '—'}</div>
                  <div className="text-label-sm text-ink-soft">{bill.patient?.mrn ?? '—'}</div>
                </td>
                <td className="px-5 py-3 text-right font-medium text-ink">{money(bill.netAmount)}</td>
                <td className="px-5 py-3 text-right text-ink-muted">{money(outstanding(bill))}</td>
                <td className="px-5 py-3 text-ink-muted">{bill.claims?.length ?? 0}</td>
                {canClaim && (
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onClaim(bill.id)}>
                      Create claim
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function PolicyModal({
  open,
  tenantId,
  providers,
  onClose,
  onSaved,
}: {
  open: boolean;
  tenantId: string;
  providers: InsuranceProvider[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [form, setForm] = useState({
    patientId: '',
    providerId: '',
    policyNumber: '',
    memberId: '',
    planName: '',
    coverageType: '',
    validFrom: '',
    validTo: '',
    coverageLimit: '',
    patientSharePercent: '0',
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatients([]);
    setPatientQuery('');
    setForm({
      patientId: '',
      providerId: providers[0]?.id ?? '',
      policyNumber: '',
      memberId: '',
      planName: '',
      coverageType: '',
      validFrom: '',
      validTo: '',
      coverageLimit: '',
      patientSharePercent: '0',
      notes: '',
    });
  }, [open, providers]);

  useEffect(() => {
    if (!open || !patientQuery.trim()) return;
    const handle = setTimeout(() => {
      patientsApi
        .list(tenantId, patientQuery.trim())
        .then(setPatients)
        .catch(() => setPatients([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [open, patientQuery, tenantId]);

  async function submit() {
    if (!form.patientId || !form.providerId || !form.policyNumber.trim()) {
      toast.error('Select patient, provider, and policy number.');
      return;
    }
    setBusy(true);
    try {
      await insuranceApi.createPolicy(tenantId, {
        patientId: form.patientId,
        providerId: form.providerId,
        policyNumber: form.policyNumber.trim(),
        memberId: form.memberId.trim() || undefined,
        planName: form.planName.trim() || undefined,
        coverageType: form.coverageType.trim() || undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        coverageLimit: form.coverageLimit ? toMinor(form.coverageLimit) ?? undefined : undefined,
        patientSharePercent: form.patientSharePercent ? Number(form.patientSharePercent) : undefined,
        notes: form.notes.trim() || undefined,
      });
      await onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add patient policy"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save policy
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Find patient" required>
          <Input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Search name, MRN, phone" />
        </FormField>
        {patients.length > 0 && (
          <div className="max-h-32 overflow-auto rounded-md border border-line">
            {patients.map((p) => (
              <button
                key={p.id}
                className={`block w-full px-3 py-2 text-left text-body-sm hover:bg-canvas ${form.patientId === p.id ? 'bg-primary-50 text-primary-700' : ''}`}
                onClick={() => setForm((f) => ({ ...f, patientId: p.id }))}
              >
                {p.fullName} <span className="text-ink-soft">· {p.mrn}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Provider" required>
            <Select value={form.providerId} onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}>
              <option value="">Select provider</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Policy number" required>
            <Input value={form.policyNumber} onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))} />
          </FormField>
          <FormField label="Member ID">
            <Input value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))} />
          </FormField>
          <FormField label="Plan name">
            <Input value={form.planName} onChange={(e) => setForm((f) => ({ ...f, planName: e.target.value }))} />
          </FormField>
          <FormField label="Valid from">
            <Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
          </FormField>
          <FormField label="Valid to">
            <Input type="date" value={form.validTo} onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))} />
          </FormField>
          <FormField label="Coverage limit">
            <Input inputMode="decimal" value={form.coverageLimit} onChange={(e) => setForm((f) => ({ ...f, coverageLimit: e.target.value }))} />
          </FormField>
          <FormField label="Patient share %">
            <Input type="number" min={0} max={100} value={form.patientSharePercent} onChange={(e) => setForm((f) => ({ ...f, patientSharePercent: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Notes">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </FormField>
      </div>
    </Modal>
  );
}

function ClaimModal({
  open,
  tenantId,
  prefillBillId,
  bills,
  policies,
  onClose,
  onSaved,
}: {
  open: boolean;
  tenantId: string;
  prefillBillId: string;
  bills: Bill[];
  policies: PatientInsurancePolicy[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [billId, setBillId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [patientShare, setPatientShare] = useState('');
  const [notes, setNotes] = useState('');
  const [submitNow, setSubmitNow] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBillId(prefillBillId || bills[0]?.id || '');
    setPolicyId('');
    setClaimAmount('');
    setPatientShare('');
    setNotes('');
    setSubmitNow(true);
  }, [open, prefillBillId, bills]);

  const selectedBill = bills.find((b) => b.id === billId);
  const policyOptions = selectedBill ? policies.filter((p) => p.patientId === selectedBill.patientId && p.active) : [];
  const selectedPolicy = policies.find((p) => p.id === policyId);
  const autoShare = selectedBill && selectedPolicy ? Math.round((selectedBill.netAmount * (selectedPolicy.coverage?.patientSharePercent ?? 0)) / 100) : 0;
  const autoClaim =
    selectedBill && selectedPolicy
      ? Math.min(
          Math.max(0, selectedBill.netAmount - autoShare),
          selectedPolicy.coverage?.coverageLimit && selectedPolicy.coverage.coverageLimit > 0
            ? selectedPolicy.coverage.coverageLimit
            : selectedBill.netAmount,
        )
      : 0;

  useEffect(() => {
    if (policyOptions.length > 0 && !policyId) setPolicyId(policyOptions[0].id);
  }, [policyOptions, policyId]);

  async function submit() {
    if (!billId || !policyId) {
      toast.error('Select a bill and patient policy.');
      return;
    }
    setBusy(true);
    try {
      await insuranceApi.createClaim(tenantId, {
        billId,
        patientPolicyId: policyId,
        claimAmount: claimAmount ? toMinor(claimAmount) ?? undefined : undefined,
        patientShare: patientShare ? toMinor(patientShare) ?? undefined : undefined,
        notes: notes.trim() || undefined,
        submit: submitNow,
      });
      await onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create claim from bill"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Create claim
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Bill" required>
          <Select value={billId} onChange={(e) => setBillId(e.target.value)}>
            <option value="">Select bill</option>
            {bills.map((b) => (
              <option key={b.id} value={b.id}>
                {b.billNumber} · {b.patient?.fullName ?? 'Patient'} · {money(b.netAmount)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Patient policy" required>
          <Select value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            <option value="">Select policy</option>
            {policyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.provider?.name ?? 'Provider'} · {p.policyNumber}
              </option>
            ))}
          </Select>
        </FormField>
        {selectedBill && selectedPolicy && (
          <div className="rounded-md bg-canvas px-3 py-2 text-body-sm text-ink-muted">
            Suggested claim <span className="font-medium text-ink">{money(autoClaim)}</span>, patient share{' '}
            <span className="font-medium text-ink">{money(autoShare)}</span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Claim amount override">
            <Input inputMode="decimal" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder={money(autoClaim)} />
          </FormField>
          <FormField label="Patient share override">
            <Input inputMode="decimal" value={patientShare} onChange={(e) => setPatientShare(e.target.value)} placeholder={money(autoShare)} />
          </FormField>
        </div>
        <FormField label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <label className="flex items-center gap-2 text-body-sm text-ink-muted">
          <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} /> Submit claim immediately
        </label>
      </div>
    </Modal>
  );
}

export default function InsurancePage() {
  return (
    <Protected
      requireModule="INSURANCE"
      allowedRoles={['INSURANCE_STAFF', 'BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN']}
      requirePermission={['insurance.read']}
    >
      <InsuranceInner />
    </Protected>
  );
}
