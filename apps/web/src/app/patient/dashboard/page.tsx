'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, CalendarDays, Receipt, FlaskConical, FileText, LayoutDashboard, Building2, LogOut, Clock, MapPin, Pill, Plus, Search, CheckCircle2 } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  portalApi,
  inrMoney,
  type LinkedHospital,
  type PortalMe,
  type PortalDashboard,
  type PortalAppointment,
  type PortalBill,
  type PortalReport,
  type PortalPrescription,
  type PortalDocument,
} from '@/lib/patient-portal';
import { publicApi, type SearchRow } from '@/lib/public';

type Tab = 'overview' | 'appointments' | 'bills' | 'reports' | 'prescriptions' | 'documents';
const STORE = 'hms_portal_tenant';

export default function PatientDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<PortalMe | null>(null);
  const [hospitals, setHospitals] = useState<LinkedHospital[] | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('overview');
  const [err, setErr] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

  // Wait for Firebase auth, then load identity + linked hospitals.
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      router.replace('/patient/login');
      return;
    }
    let active = true;
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (!active) return;
        if (!u) {
          router.replace('/patient/login');
          return;
        }
        try {
          const [profile, linked] = await Promise.all([portalApi.me(), portalApi.linkedHospitals()]);
          if (!active) return;
          setMe(profile);
          setHospitals(linked);
          const stored = typeof window !== 'undefined' ? localStorage.getItem(STORE) : null;
          setTenantId(linked.find((h) => h.tenantId === stored)?.tenantId ?? linked[0]?.tenantId ?? '');
          setReady(true);
        } catch (e) {
          setErr((e as Error).message);
          setReady(true);
        }
      });
      return () => unsub();
    });
    return () => {
      active = false;
    };
  }, [router]);

  function selectHospital(id: string) {
    setTenantId(id);
    setTab('overview');
    if (typeof window !== 'undefined') localStorage.setItem(STORE, id);
  }

  async function logout() {
    const auth = getFirebaseAuth();
    if (auth) {
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    }
    router.replace('/patient/login');
  }

  const current = hospitals?.find((h) => h.tenantId === tenantId) ?? null;

  if (!ready) return <Centered>Loading your portal…</Centered>;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            Patient Portal
          </div>
          <div className="flex items-center gap-3">
            {hospitals && hospitals.length > 1 && (
              <select
                value={tenantId}
                onChange={(e) => selectHospital(e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-body-sm text-ink focus:border-primary focus:outline-none"
              >
                {hospitals.map((h) => (
                  <option key={h.tenantId} value={h.tenantId}>
                    {h.hospitalName}
                  </option>
                ))}
              </select>
            )}
            <span className="hidden text-body-sm text-ink-muted sm:inline">{me?.displayName ?? me?.email}</span>
            <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-body-sm font-medium text-ink hover:bg-canvas">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {err && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{err}</div>}

        {hospitals && hospitals.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
            <Building2 className="mx-auto mb-3 h-9 w-9 text-ink-soft" />
            <h2 className="text-title-lg font-semibold text-ink">No hospital records linked yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-body-md text-ink-muted">
              When you book or visit a hospital that uses this portal, your records will appear here.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={() => setShowLink(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 font-medium text-ink hover:bg-canvas">
                <Plus className="h-4 w-4" /> Link an existing record
              </button>
              <Link href="/doctors" className="inline-block rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90">
                Find a doctor & book
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-body-sm text-ink-muted">
                <Building2 className="h-4 w-4 text-primary" /> Viewing records from <span className="font-semibold text-ink">{current?.hospitalName}</span>
                {current?.city && <span className="text-ink-soft">· {current.city}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowLink(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-body-sm font-medium text-ink hover:bg-canvas">
                  <Plus className="h-4 w-4" /> Link a hospital
                </button>
                <Link href="/doctors" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-body-sm font-medium text-primary hover:bg-canvas">
                  Book new appointment
                </Link>
              </div>
            </div>

            <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
              {([
                ['overview', 'Overview', LayoutDashboard],
                ['appointments', 'Appointments', CalendarDays],
                ['bills', 'Bills', Receipt],
                ['reports', 'Reports', FlaskConical],
                ['prescriptions', 'Prescriptions', Pill],
                ['documents', 'Documents', FileText],
              ] as [Tab, string, typeof LayoutDashboard][]).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-body-sm font-medium ${
                    tab === key ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </nav>

            {tenantId && <TabContent tab={tab} tenantId={tenantId} />}
          </>
        )}
      </main>
      {showLink && <LinkHospitalModal onClose={() => setShowLink(false)} />}
    </div>
  );
}

function TabContent({ tab, tenantId }: { tab: Tab; tenantId: string }) {
  if (tab === 'overview') return <Overview tenantId={tenantId} />;
  if (tab === 'appointments') return <Appointments tenantId={tenantId} />;
  if (tab === 'bills') return <Bills tenantId={tenantId} />;
  if (tab === 'reports') return <Reports tenantId={tenantId} />;
  if (tab === 'prescriptions') return <Prescriptions tenantId={tenantId} />;
  return <Documents tenantId={tenantId} />;
}

function useData<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    setData(null);
    setErr(null);
    fn().then(setData).catch((e) => setErr((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => load(), [load]);
  return { data, err };
}

function Overview({ tenantId }: { tenantId: string }) {
  const { data, err } = useData<PortalDashboard>(() => portalApi.dashboard(tenantId), [tenantId]);
  if (err) return <Err msg={err} />;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel title="Next appointment" icon={CalendarDays}>
        {data.upcoming ? (
          <>
            <div className="font-medium text-ink">{new Date(data.upcoming.scheduledAt).toLocaleString(undefined, { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-body-sm text-ink-muted">{data.upcoming.doctorName ?? 'Doctor'} · {data.upcoming.consultationType === 'TELEHEALTH' ? 'Telehealth' : 'In-person'}</div>
          </>
        ) : (
          <p className="text-body-sm text-ink-soft">No upcoming appointments.</p>
        )}
      </Panel>
      <Panel title="Latest bill" icon={Receipt}>
        {data.recentBill ? (
          <>
            <div className="font-medium text-ink">{inrMoney(data.recentBill.netAmount)} <span className="ml-2 text-body-sm text-ink-muted">{data.recentBill.status}</span></div>
            <div className="text-body-sm text-ink-soft">{data.recentBill.billNumber}</div>
          </>
        ) : (
          <p className="text-body-sm text-ink-soft">No bills yet.</p>
        )}
      </Panel>
      <Panel title="Recent document" icon={FileText}>
        {data.recentDoc ? <div className="font-medium text-ink">{data.recentDoc.title}</div> : <p className="text-body-sm text-ink-soft">No documents shared yet.</p>}
      </Panel>
      <Panel title="Your record" icon={Building2}>
        <div className="font-medium text-ink">{data.patient?.fullName}</div>
        <div className="text-body-sm text-ink-soft">MRN {data.patient?.mrn} · {data.hospitalName}</div>
      </Panel>
    </div>
  );
}

function Appointments({ tenantId }: { tenantId: string }) {
  const { data, err } = useData<PortalAppointment[]>(() => portalApi.appointments(tenantId), [tenantId]);
  if (err) return <Err msg={err} />;
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty msg="No appointments yet." />;
  return (
    <div className="space-y-2">
      {data.map((a) => (
        <div key={a.id} className="flex items-center justify-between rounded-lg border border-line bg-surface p-4">
          <div>
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <Clock className="h-4 w-4 text-ink-muted" />
              {new Date(a.scheduledAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-body-sm text-ink-muted">{a.doctorName ?? 'Doctor'} · {a.consultationType === 'TELEHEALTH' ? 'Telehealth' : 'In-person'}</div>
          </div>
          <Chip status={a.status} />
        </div>
      ))}
    </div>
  );
}

function Bills({ tenantId }: { tenantId: string }) {
  const { data, err } = useData<PortalBill[]>(() => portalApi.bills(tenantId), [tenantId]);
  if (err) return <Err msg={err} />;
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty msg="No bills yet." />;
  return (
    <div className="space-y-2">
      {data.map((b) => (
        <div key={b.id} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-body-sm text-ink">{b.billNumber}</span>
            <Chip status={b.status} />
          </div>
          <div className="mt-2 flex gap-6 text-body-sm">
            <span className="text-ink-muted">Total <span className="font-semibold text-ink">{inrMoney(b.netAmount)}</span></span>
            <span className="text-ink-muted">Paid <span className="font-medium text-ink">{inrMoney(b.paid)}</span></span>
            <span className="text-ink-muted">Due <span className="font-semibold text-ink">{inrMoney(b.due)}</span></span>
          </div>
          {b.due > 0 && <p className="mt-2 text-label-sm text-ink-soft">Please contact the clinic to pay.</p>}
        </div>
      ))}
    </div>
  );
}

function Reports({ tenantId }: { tenantId: string }) {
  const { data, err } = useData<PortalReport[]>(() => portalApi.reports(tenantId), [tenantId]);
  if (err) return <Err msg={err} />;
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty msg="No lab reports shared yet." />;
  return (
    <div className="space-y-3">
      {data.map((r) => (
        <div key={r.id} className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-2 text-body-sm text-ink-soft">{new Date(r.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          {r.tests.map((t, i) => (
            <div key={i} className="border-t border-line py-2 first:border-0 first:pt-0">
              <div className="font-medium text-ink">{t.testName}</div>
              {t.results.map((res, j) => (
                <div key={j} className="flex items-center gap-3 text-body-sm">
                  <span className={res.abnormalFlag !== 'NORMAL' ? 'font-semibold text-danger-fg' : 'text-ink'}>{res.value} {res.unit}</span>
                  {res.referenceRange && <span className="text-ink-soft">Ref: {res.referenceRange}</span>}
                  {res.abnormalFlag !== 'NORMAL' && <Chip status={res.abnormalFlag} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Prescriptions({ tenantId }: { tenantId: string }) {
  const { data, err } = useData<PortalPrescription[]>(() => portalApi.prescriptions(tenantId), [tenantId]);
  if (err) return <Err msg={err} />;
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty msg="No prescriptions shared yet." />;
  return (
    <div className="space-y-3">
      {data.map((p) => (
        <div key={p.id} className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-body-sm text-ink-soft">{new Date(p.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <Chip status={p.status} />
          </div>
          <ul className="space-y-1.5">
            {p.items.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2 text-body-sm">
                <Pill className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>
                  <span className="font-medium text-ink">{i.drugName}</span>
                  <span className="text-ink-muted">{[i.dosage, i.frequency, i.duration].filter(Boolean).length ? ' · ' + [i.dosage, i.frequency, i.duration].filter(Boolean).join(' · ') : ''}</span>
                  {i.instructions && <span className="block text-label-sm text-ink-soft">{i.instructions}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Documents({ tenantId }: { tenantId: string }) {
  const { data, err } = useData<PortalDocument[]>(() => portalApi.documents(tenantId), [tenantId]);
  if (err) return <Err msg={err} />;
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty msg="No documents shared with you yet." />;
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <a
          key={d.id}
          href={d.documentUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => void portalApi.markDocumentViewed(tenantId, d.id).catch(() => {})}
          className="flex items-center justify-between rounded-lg border border-line bg-surface p-4 hover:border-primary"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <div className="font-medium text-ink">{d.title}</div>
              <div className="text-label-sm text-ink-soft">{d.category} · {new Date(d.publishedAt).toLocaleDateString()}</div>
            </div>
          </div>
          <span className="text-body-sm font-medium text-primary">View</span>
        </a>
      ))}
    </div>
  );
}

function LinkHospitalModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchRow[] | null>(null);
  const [picked, setPicked] = useState<SearchRow | null>(null);
  const [mrn, setMrn] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);

  async function search() {
    setResults(null);
    try {
      setResults(await publicApi.hospitals(q));
    } catch {
      setResults([]);
    }
  }
  async function submit() {
    if (!picked) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await portalApi.requestAccess({ tenantId: picked.tenantId, mrn: mrn.trim() || undefined, phone: phone.trim() || undefined });
      if (out.status === 'requested') setMsg({ tone: 'ok', text: 'Request sent. The hospital will review and link your records.' });
      else if (out.status === 'already_linked') setMsg({ tone: 'ok', text: 'You are already linked to this hospital.' });
      else setMsg({ tone: 'warn', text: 'No matching record found. Check your MRN/mobile or contact the hospital.' });
    } catch (e) {
      setMsg({ tone: 'warn', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-title-lg font-semibold text-ink">Link an existing hospital record</h2>
        <p className="mb-4 text-body-sm text-ink-muted">Find a hospital where you already have records, then verify with your MRN or registered mobile.</p>

        {!picked ? (
          <>
            <form onSubmit={(e) => { e.preventDefault(); search(); }} className="flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hospital name or city" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none" />
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-medium text-white"><Search className="h-4 w-4" /></button>
            </form>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {results?.map((h) => (
                <button key={h.id} onClick={() => setPicked(h)} className="flex w-full items-center gap-2 rounded-lg border border-line p-2.5 text-left hover:border-primary">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span><span className="font-medium text-ink">{h.hospitalName}</span>{h.location && <span className="block text-label-sm text-ink-soft">{h.location}</span>}</span>
                </button>
              ))}
              {results && results.length === 0 && <p className="py-3 text-center text-body-sm text-ink-soft">No hospitals found.</p>}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-canvas p-2.5">
              <Building2 className="h-4 w-4 text-primary" /> <span className="font-medium text-ink">{picked.hospitalName}</span>
              <button onClick={() => { setPicked(null); setMsg(null); }} className="ml-auto text-label-sm text-primary">Change</button>
            </div>
            <label className="mb-1 block text-body-sm font-medium text-ink">MRN (if known)</label>
            <input value={mrn} onChange={(e) => setMrn(e.target.value)} className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none" />
            <label className="mb-1 block text-body-sm font-medium text-ink">Registered mobile</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none" />
            {msg && (
              <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-body-sm ${msg.tone === 'ok' ? 'bg-success-bg text-success-fg' : 'bg-warning-bg text-warning-fg'}`}>
                {msg.tone === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : null} {msg.text}
              </div>
            )}
            <button onClick={submit} disabled={busy || (!mrn.trim() && !phone.trim())} className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? 'Sending…' : 'Request access'}
            </button>
          </>
        )}
        <button onClick={onClose} className="mt-3 w-full text-body-sm font-medium text-ink-muted hover:text-ink">Close</button>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof LayoutDashboard; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-2 flex items-center gap-1.5 text-label-md uppercase text-ink-soft">
        <Icon className="h-4 w-4" /> {title}
      </div>
      {children}
    </div>
  );
}
function Chip({ status }: { status: string }) {
  const tone =
    ['PAID', 'CONFIRMED', 'COMPLETED', 'SCHEDULED'].includes(status) ? 'bg-success-bg text-success-fg' :
    ['CANCELLED', 'REJECTED', 'CRITICAL', 'HIGH', 'LOW'].includes(status) ? 'bg-danger-bg text-danger-fg' :
    'bg-canvas text-ink-muted';
  return <span className={`rounded-full px-2 py-0.5 text-label-sm font-medium ${tone}`}>{status}</span>;
}
function Loading() {
  return <p className="py-8 text-center text-body-sm text-ink-soft">Loading…</p>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-line bg-surface px-6 py-10 text-center text-body-sm text-ink-muted">{msg}</div>;
}
function Err({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">{msg}</div>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-canvas text-body-sm text-ink-soft">{children}</div>;
}
