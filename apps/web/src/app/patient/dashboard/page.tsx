'use client';

import Link from 'next/link';
import { CalendarDays, Receipt, FileText, Building2, Stethoscope, LinkIcon, Clock, ArrowRight } from 'lucide-react';
import { usePortal } from '@/components/patient/portal-shell';
import { useData, Loading, ErrorState, EmptyState, StatusBadge, portalMoney } from '@/components/patient/portal-ui';
import { portalApi, type PortalDashboard } from '@/lib/patient-portal';

export default function DashboardPage() {
  const { me, tenantId, current, hospitals, openLinkModal } = usePortal();
  const firstName = (me?.displayName ?? me?.email ?? 'there').split(/[ @]/)[0];

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <section className="rounded-xl border border-line bg-gradient-to-br from-primary-50 to-surface p-6">
        <h2 className="text-headline-sm font-semibold text-ink">Welcome back, {firstName}</h2>
        <p className="mt-1 max-w-lg text-body-md text-ink-muted">
          {current
            ? <>You're viewing your records from <span className="font-medium text-ink">{current.hospitalName}</span>. Book a new visit or review what your care teams have shared.</>
            : 'Find and book healthcare appointments, then link your hospital records to see them all in one place.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/doctors" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">
            <Stethoscope className="h-4 w-4" /> Find a Doctor
          </Link>
          <button onClick={openLinkModal} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 font-medium text-ink hover:bg-canvas">
            <LinkIcon className="h-4 w-4" /> Link Hospital Record
          </button>
        </div>
      </section>

      {hospitals.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hospital records linked yet"
          body="When you book or visit a hospital that uses this portal, your records appear here. You can also link an existing record now."
          action={
            <div className="flex gap-2">
              <button onClick={openLinkModal} className="rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-canvas">Link a record</button>
              <Link href="/doctors" className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">Find a doctor</Link>
            </div>
          }
        />
      ) : (
        tenantId && <Overview tenantId={tenantId} />
      )}
    </div>
  );
}

function Overview({ tenantId }: { tenantId: string }) {
  const { data, err } = useData<PortalDashboard>(() => portalApi.dashboard(tenantId), [tenantId]);
  if (err) return <ErrorState msg={err} />;
  if (!data) return <Loading label="Loading your dashboard…" />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Upcoming appointment */}
      <Card title="Upcoming appointment" icon={CalendarDays} href="/patient/appointments">
        {data.upcoming ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 font-medium text-ink">
                <Clock className="h-4 w-4 text-ink-muted" />
                {new Date(data.upcoming.scheduledAt).toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="mt-0.5 text-body-sm text-ink-muted">
                {data.upcoming.doctorName ?? 'Doctor'} · {data.upcoming.consultationType === 'TELEHEALTH' ? 'Telehealth' : 'In-person'}
              </div>
            </div>
            <StatusBadge status={data.upcoming.status} />
          </div>
        ) : (
          <Quiet text="No upcoming appointments." cta={{ href: '/doctors', label: 'Book now' }} />
        )}
      </Card>

      {/* Latest bill */}
      <Card title="Latest bill" icon={Receipt} href="/patient/bills">
        {data.recentBill ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-ink">{portalMoney(data.recentBill.netAmount)}</div>
              <div className="mt-0.5 font-mono text-body-sm text-ink-soft">{data.recentBill.billNumber}</div>
            </div>
            <StatusBadge status={data.recentBill.status} />
          </div>
        ) : (
          <Quiet text="No bills yet." />
        )}
      </Card>

      {/* Recent document */}
      <Card title="Recent document" icon={FileText} href="/patient/documents">
        {data.recentDoc ? (
          <div>
            <div className="font-medium text-ink">{data.recentDoc.title}</div>
            <div className="mt-0.5 text-body-sm text-ink-soft">{data.recentDoc.category} · {new Date(data.recentDoc.publishedAt).toLocaleDateString()}</div>
          </div>
        ) : (
          <Quiet text="Documents appear here when a hospital shares them with you." />
        )}
      </Card>

      {/* Your record */}
      <Card title="Your record" icon={Building2} href="/patient/hospitals">
        {data.patient ? (
          <div>
            <div className="font-medium text-ink">{data.patient.fullName}</div>
            <div className="mt-0.5 text-body-sm text-ink-soft">MRN {data.patient.mrn} · {data.hospitalName}</div>
          </div>
        ) : (
          <Quiet text={`Record at ${data.hospitalName}.`} />
        )}
      </Card>
    </div>
  );
}

function Card({ title, icon: Icon, href, children }: { title: string; icon: typeof CalendarDays; href: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-label-md uppercase tracking-wide text-ink-soft">
          <Icon className="h-4 w-4" /> {title}
        </div>
        <Link href={href} className="inline-flex items-center gap-0.5 text-label-sm font-medium text-primary hover:underline">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Quiet({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-body-sm text-ink-soft">{text}</p>
      {cta && <Link href={cta.href} className="whitespace-nowrap text-body-sm font-medium text-primary hover:underline">{cta.label}</Link>}
    </div>
  );
}
