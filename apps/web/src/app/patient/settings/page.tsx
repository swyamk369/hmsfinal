'use client';

import { useCallback, useEffect, useState } from 'react';
import { User, Bell, Lock, Building2, Plus, Check } from 'lucide-react';
import { portalApi, type PortalSettings, type NotificationPrefs } from '@/lib/patient-portal';
import { getFirebaseAuth } from '@/lib/firebase';
import { usePortal } from '@/components/patient/portal-shell';
import { Loading, ErrorState, SubTabs } from '@/components/patient/portal-ui';

const inputCls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
type Tab = 'profile' | 'notifications' | 'security' | 'records';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const [data, setData] = useState<PortalSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await portalApi.settings());
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <ErrorState msg={err} />;
  if (!data) return <Loading label="Loading settings…" />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-headline-md text-ink">Settings</h1>
      <p className="mb-5 text-body-sm text-ink-muted">Manage your profile, notifications, and hospital records.</p>

      <div className="mb-6">
        <SubTabs<Tab>
          tabs={[
            { key: 'profile', label: 'Personal Info' },
            { key: 'notifications', label: 'Notifications' },
            { key: 'security', label: 'Security' },
            { key: 'records', label: 'Hospital Records' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'profile' && <ProfileTab data={data} onSaved={load} />}
      {tab === 'notifications' && <NotificationsTab prefs={data.notifications} />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'records' && <RecordsTab />}
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 text-headline-sm text-ink"><Icon className="h-5 w-5 text-primary" /> {title}</h2>
      {children}
    </div>
  );
}

function Note({ tone, text }: { tone: 'ok' | 'err'; text: string }) {
  return (
    <div className={`mb-3 rounded-lg px-3 py-2 text-body-sm ${tone === 'ok' ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg'}`}>{text}</div>
  );
}

function ProfileTab({ data, onSaved }: { data: PortalSettings; onSaved: () => Promise<void> }) {
  const [displayName, setDisplayName] = useState(data.profile.displayName ?? '');
  const [mobile, setMobile] = useState(data.profile.mobile ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await portalApi.updateProfile({ displayName: displayName.trim(), mobile: mobile.trim() });
      setMsg({ tone: 'ok', text: 'Profile updated.' });
      await onSaved();
    } catch (e) {
      setMsg({ tone: 'err', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={User} title="Personal information">
      {msg && <Note tone={msg.tone} text={msg.text} />}
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-label-md text-ink">Email</span>
          <input className={`${inputCls} cursor-not-allowed bg-canvas`} value={data.profile.email ?? ''} disabled />
          <span className="mt-1 block text-label-sm text-ink-soft">Email is managed by your sign-in account.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-label-md text-ink">Display name</span>
          <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-label-md text-ink">Mobile</span>
          <input className={inputCls} value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </label>
      </div>
      <button onClick={save} disabled={busy} className="mt-4 rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-white hover:bg-primary-700 disabled:opacity-50">
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </Card>
  );
}

const PREF_LABELS: { key: keyof NotificationPrefs; label: string; help: string }[] = [
  { key: 'notifyBookingUpdates', label: 'Booking updates', help: 'Confirmations, reschedules, and cancellations.' },
  { key: 'notifyDocuments', label: 'New documents', help: 'When a hospital shares a report or document.' },
  { key: 'notifyBilling', label: 'Billing updates', help: 'New bills and payment reminders.' },
  { key: 'notifyByEmail', label: 'Email notifications', help: 'Also receive the above by email.' },
];

function NotificationsTab({ prefs }: { prefs: NotificationPrefs }) {
  const [state, setState] = useState<NotificationPrefs>(prefs);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle(key: keyof NotificationPrefs) {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    setBusy(true);
    setMsg(null);
    try {
      await portalApi.updateNotificationPrefs(next);
      setMsg('Preferences saved.');
    } catch {
      setState(state); // revert
      setMsg('Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={Bell} title="Notification preferences">
      {msg && <p className="mb-3 text-body-sm text-ink-muted">{msg}</p>}
      <ul className="divide-y divide-line">
        {PREF_LABELS.map(({ key, label, help }) => (
          <li key={key} className="flex items-center justify-between py-3">
            <div>
              <p className="text-body-md text-ink">{label}</p>
              <p className="text-label-sm text-ink-soft">{help}</p>
            </div>
            <button
              role="switch"
              aria-checked={state[key]}
              disabled={busy}
              onClick={() => toggle(key)}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${state[key] ? 'bg-primary' : 'bg-line'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${state[key] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SecurityTab() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  async function change() {
    if (pw.length < 6) {
      setMsg({ tone: 'err', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (pw !== pw2) {
      setMsg({ tone: 'err', text: 'Passwords do not match.' });
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      setMsg({ tone: 'err', text: 'Please sign in again to change your password.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { updatePassword } = await import('firebase/auth');
      await updatePassword(auth.currentUser, pw);
      setMsg({ tone: 'ok', text: 'Password updated.' });
      setPw('');
      setPw2('');
    } catch (e) {
      const raw = (e as Error).message;
      setMsg({ tone: 'err', text: raw.includes('requires-recent-login') ? 'For security, please sign out and sign in again, then retry.' : 'Could not update password.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card icon={Lock} title="Change password">
      {msg && <Note tone={msg.tone} text={msg.text} />}
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-label-md text-ink">New password</span>
          <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-label-md text-ink">Confirm new password</span>
          <input type="password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
      </div>
      <button onClick={change} disabled={busy} className="mt-4 rounded-lg bg-primary px-4 py-2 text-label-md font-medium text-white hover:bg-primary-700 disabled:opacity-50">
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </Card>
  );
}

function RecordsTab() {
  const { hospitals, openLinkModal } = usePortal();
  return (
    <Card icon={Building2} title="Linked hospital records">
      {hospitals.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No hospital records linked yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {hospitals.map((h) => (
            <li key={h.tenantId} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success-fg" />
                <div>
                  <p className="text-body-md text-ink">{h.hospitalName}</p>
                  {h.city && <p className="text-label-sm text-ink-soft">{h.city}</p>}
                </div>
              </div>
              <span className="text-label-sm text-success-fg">Linked</span>
            </li>
          ))}
        </ul>
      )}
      <button onClick={openLinkModal} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-label-md font-medium text-ink hover:bg-canvas">
        <Plus className="h-4 w-4" /> Link another hospital record
      </button>
    </Card>
  );
}
