'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  HeartPulse,
  LayoutDashboard,
  CalendarDays,
  Receipt,
  Pill,
  FileText,
  Building2,
  Heart,
  Users,
  Bell,
  Settings as SettingsIcon,
  HelpCircle,
  LogOut,
  Plus,
  Search,
  CheckCircle2,
  Menu,
  X,
} from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';
import { portalApi, type LinkedHospital, type PortalMe } from '@/lib/patient-portal';
import { publicApi, type SearchRow } from '@/lib/public';
import { AiChatbot } from '../shared/ai-chatbot';

/**
 * Persistent patient-portal shell + context. Mounted once by `app/patient/layout.tsx`
 * so identity + linked hospitals load a single time and survive route navigation.
 * Patient auth is a SEPARATE Firebase branch from staff — never useAuth()/<Protected>.
 */

const STORE = 'hms_portal_tenant';

interface PortalCtx {
  ready: boolean;
  me: PortalMe | null;
  hospitals: LinkedHospital[];
  tenantId: string;
  current: LinkedHospital | null;
  unreadCount: number;
  setTenantId: (id: string) => void;
  refresh: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  logout: () => Promise<void>;
  openLinkModal: () => void;
}

const Ctx = createContext<PortalCtx | null>(null);

export function usePortal(): PortalCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortal must be used inside <PortalShell>');
  return v;
}

const NAV: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patient/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/patient/bills', label: 'Bills', icon: Receipt },
  { href: '/patient/prescriptions', label: 'Prescriptions', icon: Pill },
  { href: '/patient/documents', label: 'Documents', icon: FileText },
  { href: '/patient/hospitals', label: 'Hospitals', icon: Building2 },
  { href: '/patient/care-team', label: 'Care Team', icon: Heart },
  { href: '/patient/family', label: 'Family', icon: Users },
  { href: '/patient/notifications', label: 'Notifications', icon: Bell },
  { href: '/patient/settings', label: 'Settings', icon: SettingsIcon },
  { href: '/patient/help', label: 'Help & Support', icon: HelpCircle },
];

// Smaller set for the mobile bottom tab bar.
const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5], { ...NAV[10], label: 'Help' }];

function titleFor(pathname: string): string {
  return NAV.find((n) => pathname.startsWith(n.href))?.label ?? 'Patient Portal';
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<PortalMe | null>(null);
  const [hospitals, setHospitals] = useState<LinkedHospital[]>([]);
  const [tenantId, setTenantIdState] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  async function loadNotifications() {
    try {
      const n = await portalApi.notifications();
      setUnreadCount(n.unread);
    } catch {
      // Non-critical — don't block the shell
    }
  }

  async function load() {
    const [profile, linked] = await Promise.all([portalApi.me(), portalApi.linkedHospitals()]);
    setMe(profile);
    setHospitals(linked);
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORE) : null;
    setTenantIdState(linked.find((h) => h.tenantId === stored)?.tenantId ?? linked[0]?.tenantId ?? '');
    await loadNotifications();
  }

  // Wait for Firebase auth, then load identity + linked hospitals once.
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
          await load();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          if (active) setReady(true);
        }
      });
      return () => unsub();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileNav(false), [pathname]);

  function setTenantId(id: string) {
    setTenantIdState(id);
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

  const current = hospitals.find((h) => h.tenantId === tenantId) ?? null;
  const ctx: PortalCtx = {
    ready,
    me,
    hospitals,
    tenantId,
    current,
    unreadCount,
    setTenantId,
    refresh: load,
    refreshNotifications: loadNotifications,
    logout,
    openLinkModal: () => setShowLink(true),
  };

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-body-sm text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <HeartPulse className="h-4 w-4 animate-pulse text-primary" /> Loading your portal…
        </span>
      </div>
    );
  }

  const NavList = (
    <nav className="flex-1 space-y-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-body-md font-medium transition ${
              active ? 'bg-primary-50 text-primary-700' : 'text-ink-muted hover:bg-canvas hover:text-ink'
            }`}
          >
            <Icon className="h-5 w-5" /> {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-canvas">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
          <SidebarHeader me={me} />
          {NavList}
          <Link
            href="/doctors"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Booking
          </Link>
        </aside>

        {/* Mobile drawer */}
        {mobileNav && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileNav(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <aside
              className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface px-4 py-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <SidebarHeader me={me} />
                <button onClick={() => setMobileNav(false)} className="text-ink-soft hover:text-ink">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {NavList}
              <Link
                href="/doctors"
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> New Booking
              </Link>
            </aside>
          </div>
        )}

        <div className="lg:pl-64">
          {/* Top bar */}
          <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileNav(true)} className="text-ink-muted hover:text-ink lg:hidden">
                  <Menu className="h-6 w-6" />
                </button>
                <h1 className="text-title-lg font-semibold text-ink">{titleFor(pathname)}</h1>
              </div>
              <div className="flex items-center gap-3">
                {hospitals.length > 1 && (
                  <select
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="max-w-[10rem] rounded-lg border border-line bg-surface px-3 py-1.5 text-body-sm text-ink focus:border-primary focus:outline-none sm:max-w-none"
                  >
                    {hospitals.map((h) => (
                      <option key={h.tenantId} value={h.tenantId}>
                        {h.hospitalName}
                      </option>
                    ))}
                  </select>
                )}
                <Link
                  href="/patient/help"
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-body-sm font-medium ${
                    pathname.startsWith('/patient/help')
                      ? 'border-primary/30 bg-primary-50 text-primary-700'
                      : 'border-line text-ink-muted hover:bg-canvas hover:text-ink'
                  }`}
                  aria-label="Help and support"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Support</span>
                </Link>
                <Link
                  href="/patient/notifications"
                  className="relative rounded-md p-2 text-ink-muted hover:bg-canvas hover:text-ink"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-body-sm font-medium text-ink hover:bg-canvas"
                >
                  <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
            {err && (
              <div className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-body-sm text-danger-fg">
                {err}
              </div>
            )}
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface lg:hidden">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-label-sm ${active ? 'text-primary' : 'text-ink-soft'}`}
              >
                <Icon className="h-5 w-5" /> {label}
              </Link>
            );
          })}
        </nav>

        {showLink && <LinkHospitalModal onClose={() => setShowLink(false)} onLinked={load} />}
      </div>
    </Ctx.Provider>
  );
}

function SidebarHeader({ me }: { me: PortalMe | null }) {
  const name = me?.displayName ?? me?.email ?? 'Patient';
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-primary text-white">
        <HeartPulse className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-ink">Patient Portal</div>
        <div className="truncate text-label-sm text-ink-soft">{name}</div>
      </div>
    </div>
  );
}

/** Find a hospital you already have records with → verify by MRN / mobile → staff links you. */
function LinkHospitalModal({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
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
      const out = await portalApi.requestAccess({
        tenantId: picked.tenantId,
        mrn: mrn.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      if (out.status === 'requested')
        setMsg({ tone: 'ok', text: 'Request sent. The hospital will review and link your records.' });
      else if (out.status === 'already_linked') {
        setMsg({ tone: 'ok', text: 'You are already linked to this hospital.' });
        onLinked();
      } else setMsg({ tone: 'warn', text: 'No matching record found. Check your MRN/mobile or contact the hospital.' });
    } catch (e) {
      setMsg({ tone: 'warn', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-title-lg font-semibold text-ink">Link an existing hospital record</h2>
        <p className="mb-4 text-body-sm text-ink-muted">
          Find a hospital where you already have records, then verify with your MRN or registered mobile.
        </p>

        {!picked ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
              className="flex gap-2"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Hospital name or city"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 font-medium text-white"
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
              {results?.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setPicked(h)}
                  className="flex w-full items-center gap-2 rounded-lg border border-line p-2.5 text-left hover:border-primary"
                >
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>
                    <span className="font-medium text-ink">{h.hospitalName}</span>
                    {h.location && <span className="block text-label-sm text-ink-soft">{h.location}</span>}
                  </span>
                </button>
              ))}
              {results && results.length === 0 && (
                <p className="py-3 text-center text-body-sm text-ink-soft">No hospitals found.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-canvas p-2.5">
              <Building2 className="h-4 w-4 text-primary" />{' '}
              <span className="font-medium text-ink">{picked.hospitalName}</span>
              <button
                onClick={() => {
                  setPicked(null);
                  setMsg(null);
                }}
                className="ml-auto text-label-sm text-primary"
              >
                Change
              </button>
            </div>
            <label className="mb-1 block text-body-sm font-medium text-ink">MRN (if known)</label>
            <input
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none"
            />
            <label className="mb-1 block text-body-sm font-medium text-ink">Registered mobile</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none"
            />
            {msg && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-body-sm ${msg.tone === 'ok' ? 'bg-success-bg text-success-fg' : 'bg-warning-bg text-warning-fg'}`}
              >
                {msg.tone === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : null} {msg.text}
              </div>
            )}
            <button
              onClick={submit}
              disabled={busy || (!mrn.trim() && !phone.trim())}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Request access'}
            </button>
          </>
        )}
        <button onClick={onClose} className="mt-3 w-full text-body-sm font-medium text-ink-muted hover:text-ink">
          Close
        </button>
      </div>
    </div>
  );
}
