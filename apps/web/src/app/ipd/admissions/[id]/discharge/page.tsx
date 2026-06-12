'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react';
import Protected from '@/components/Protected';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ipdApi, type AdmissionDetail } from '@/lib/ipd';
import { ageFromDob, formatDate, formatDateTime, money } from '@/lib/format';
import {
  Button,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Section,
  Spinner,
  StatusChip,
  Textarea,
} from '@/components/ui';

function DischargeInner({ id }: { id: string }) {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const router = useRouter();
  const toast = useToast();

  const [admission, setAdmission] = useState<AdmissionDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      const adm = await ipdApi.getAdmission(t, id);
      setAdmission(adm);
      setSummary(adm.dischargeSummary?.summary ?? '');
      setInstructions(adm.dischargeSummary?.instructions ?? adm.dischargeNotes ?? '');
      setFollowUpDate(adm.dischargeSummary?.followUpDate ? adm.dischargeSummary.followUpDate.slice(0, 10) : '');
      setReason(adm.dischargeReason ?? '');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [t, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    if (!reason.trim() || !summary.trim()) {
      setFormErr('Discharge reason and summary are required.');
      return;
    }
    setBusy(true);
    setFormErr(null);
    try {
      await ipdApi.discharge(t, id, {
        reason: reason.trim(),
        summary: summary.trim(),
        instructions: instructions.trim() || undefined,
        followUpDate: followUpDate || undefined,
      });
      toast.success('Patient discharged.');
      router.push(`/ipd/admissions/${id}/summary`);
    } catch (e) {
      setFormErr((e as Error).message);
      setBusy(false);
    }
  }

  if (err) return <ErrorState message={err} />;
  if (!admission) return <Spinner label="Loading discharge workflow..." />;

  const paid = admission.bill?.payments?.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0) ?? 0;
  const balance = admission.bill ? admission.bill.netAmount - paid : 0;
  const alreadyDischarged = admission.status !== 'ADMITTED';

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/ipd/admissions/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-ink-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to admission
      </Link>

      <PageHeader
        title="Discharge patient"
        subtitle={`${admission.patient.fullName} - ${admission.bed.ward.name} / ${admission.bed.bedNumber}`}
        action={<StatusChip status={admission.status} />}
      />

      {alreadyDischarged && (
        <div className="mb-5 rounded-md border border-warning-bg bg-warning-bg px-4 py-3 text-body-sm text-warning-fg">
          This admission is already {admission.status.toLowerCase()}. You can review or print the summary.
        </div>
      )}
      {formErr && (
        <div className="mb-5">
          <ErrorState message={formErr} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <Section title="Patient">
            <div className="space-y-3 p-5 text-body-sm">
              <Row label="Name" value={admission.patient.fullName} />
              <Row label="MRN" value={admission.patient.mrn} />
              <Row label="Age / sex" value={`${ageFromDob(admission.patient.dob)} / ${admission.patient.sex ?? '-'}`} />
              <Row label="Admitted" value={formatDateTime(admission.admittedAt)} />
              <Row label="Bed" value={`${admission.bed.ward.name} / ${admission.bed.bedNumber}`} />
              <Row label="Expected discharge" value={formatDate(admission.expectedDischargeAt)} />
            </div>
          </Section>

          <Section title="Final bill">
            <div className="space-y-3 p-5 text-body-sm">
              {admission.bill ? (
                <>
                  <Row label="Bill number" value={admission.bill.billNumber} />
                  <Row label="Status" value={<StatusChip status={admission.bill.status} />} />
                  <Row label="Net total" value={money(admission.bill.netAmount)} />
                  <Row label="Paid" value={money(paid)} />
                  <Row label="Balance" value={money(balance)} />
                </>
              ) : (
                <p className="text-ink-muted">No bill exists for this admission yet.</p>
              )}
            </div>
          </Section>
        </div>

        <Section title="Discharge details" className="lg:col-span-2">
          <div className="space-y-4 p-5">
            <FormField label="Discharge reason" required>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Clinical or administrative reason for discharge"
                disabled={alreadyDischarged}
              />
            </FormField>
            <FormField label="Discharge summary" required>
              <Textarea
                rows={6}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Diagnosis, treatment course, response, condition at discharge"
                disabled={alreadyDischarged}
              />
            </FormField>
            <FormField label="Instructions">
              <Textarea
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Medication, diet, wound care, warning signs, review instructions"
                disabled={alreadyDischarged}
              />
            </FormField>
            <FormField label="Follow-up date">
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                disabled={alreadyDischarged}
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-3 border-t border-line px-5 py-4">
            <Link href={`/ipd/admissions/${id}/summary`}>
              <Button variant="ghost" icon={FileText}>
                Printable summary
              </Button>
            </Link>
            <Button
              icon={CheckCircle2}
              onClick={confirm}
              loading={busy}
              disabled={alreadyDischarged || !reason.trim() || !summary.trim()}
            >
              Confirm discharge
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export default function DischargePage() {
  const params = useParams<{ id: string }>();
  return (
    <Protected requireModule="IPD" allowedRoles={['DOCTOR', 'HOSPITAL_ADMIN']} requirePermission={['ipd.discharge']}>
      <DischargeInner id={params.id} />
    </Protected>
  );
}
