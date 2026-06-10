'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, FlaskConical, HeartPulse, Pill, Stethoscope } from 'lucide-react';
import Protected from '@/components/Protected';
import { Button, ErrorState, FormField, Input, PageHeader, Section, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import { reportsApi, type ClinicalReport } from '@/lib/reports';
import { Breakdown, KpiGrid, ReportTable } from '../report-ui';

function ClinicalReportPageInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<ClinicalReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [endDate, startDate],
  );

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await reportsApi.clinical(t, params));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [params, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Clinical Report"
        subtitle={data ? `Consultations, diagnoses, vitals, prescriptions, lab flags, and IPD rounds · updated ${formatDateTime(data.generatedAt)}` : 'Consultations, diagnoses, vitals, prescriptions, lab flags, and IPD rounds'}
        action={<Button variant="ghost" onClick={load}>Refresh</Button>}
      />

      <div className="space-y-6">
        <Section title="Filters">
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <FormField label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
            <div className="flex items-end">
              <Button variant="dark" onClick={load} className="w-full">
                Apply
              </Button>
            </div>
          </div>
        </Section>

        {err && <ErrorState message={err} />}
        {!data && !err ? (
          <Spinner label="Loading clinical report..." />
        ) : data ? (
          <>
            <KpiGrid
              items={[
                { label: 'Consultations', value: data.totals.consultationsCompleted ?? 0, icon: Stethoscope },
                { label: 'Vitals recorded', value: data.totals.vitalsRecorded ?? 0, icon: HeartPulse },
                { label: 'Prescriptions', value: data.totals.prescriptionsFinalized ?? 0, icon: Pill },
                { label: 'Abnormal labs', value: data.totals.labAbnormalResults ?? 0, icon: FlaskConical },
                { label: 'IPD rounds', value: data.totals.ipdRounds ?? 0, hint: `${data.totals.dischargeSummaries ?? 0} discharge summaries`, icon: ClipboardPlus },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-3">
              <Breakdown title="Encounter status" data={data.encounterStatus} />
              <Breakdown title="Top diagnoses" data={data.diagnosisCounts} />
              <Breakdown title="Abnormal lab flags" data={data.labAbnormalFlags} />
            </div>

            <ReportTable
              title="Clinical activity"
              rows={data.rows}
              filename="clinical-report.csv"
              columns={[
                { key: 'type', label: 'Type' },
                { key: 'label', label: 'Detail' },
                { key: 'status', label: 'Status' },
                { key: 'date', label: 'Date', date: true },
              ]}
            />
          </>
        ) : null}
      </div>
    </>
  );
}

export default function ClinicalReportPage() {
  return (
    <Protected requireModule="REPORTS" allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'DOCTOR', 'LAB_TECH']} requirePermission={['reports.read', 'reports.clinical.read', 'encounter.read', 'lab.read']}>
      <ClinicalReportPageInner />
    </Protected>
  );
}
