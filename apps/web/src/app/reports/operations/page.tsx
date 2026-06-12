'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ClipboardList, FlaskConical, Stethoscope, Users } from 'lucide-react';
import Protected from '@/components/Protected';
import { Button, ErrorState, FormField, Input, PageHeader, Section, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import { reportsApi, type OperationsReport } from '@/lib/reports';
import { Breakdown, KpiGrid, ReportTable } from '../report-ui';

function OperationsReportPageInner() {
  const { activeTenantId } = useAuth();
  const t = activeTenantId!;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<OperationsReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      startDate,
      endDate,
      status,
    }),
    [startDate, endDate, status],
  );

  const load = useCallback(async () => {
    if (!t) return;
    setErr(null);
    try {
      setData(await reportsApi.operations(t, params));
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
        title="Operations Report"
        subtitle={
          data
            ? `Patient flow, OPD, lab, pharmacy, and IPD activity · updated ${formatDateTime(data.generatedAt)}`
            : 'Patient flow, OPD, lab, pharmacy, and IPD activity'
        }
        action={
          <Button variant="ghost" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        <Section title="Filters">
          <div className="grid gap-4 p-5 md:grid-cols-4">
            <FormField label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
            <FormField label="Encounter status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="CHECKED_IN">Checked in</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
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
          <Spinner label="Loading operations report..." />
        ) : data ? (
          <>
            <KpiGrid
              items={[
                { label: 'Registrations', value: data.totals.registrations ?? 0, icon: Users },
                { label: 'Appointments', value: data.totals.appointments ?? 0, icon: CalendarDays },
                {
                  label: 'Encounters',
                  value: data.totals.encounters ?? 0,
                  hint: `${data.totals.consultationsCompleted ?? 0} completed`,
                  icon: Stethoscope,
                },
                {
                  label: 'Lab orders',
                  value: data.totals.labOrders ?? 0,
                  hint: `${data.totals.dispenses ?? 0} pharmacy dispenses`,
                  icon: FlaskConical,
                },
                {
                  label: 'Admissions',
                  value: data.totals.admissions ?? 0,
                  hint: `${data.totals.discharges ?? 0} discharged`,
                  icon: ClipboardList,
                },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-3">
              <Breakdown title="Appointment status" data={data.appointmentStatus} />
              <Breakdown title="Encounter status" data={data.encounterStatus} />
              <Breakdown title="Encounter type" data={data.encounterType} />
              <Breakdown title="Lab lifecycle" data={data.labStatus} />
              <Breakdown title="Pharmacy lifecycle" data={data.pharmacyStatus} />
              <Breakdown title="Admission status" data={data.admissionStatus} />
            </div>

            <ReportTable
              title="Activity rows"
              rows={data.rows}
              filename="operations-report.csv"
              columns={[
                { key: 'type', label: 'Type' },
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

export default function OperationsReportPage() {
  return (
    <Protected
      requireModule="REPORTS"
      allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER']}
      requirePermission={['reports.read', 'reports.operational.read']}
    >
      <OperationsReportPageInner />
    </Protected>
  );
}
