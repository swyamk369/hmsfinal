'use client';

import Link from 'next/link';
import { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { KeyRound, Save } from 'lucide-react';
import Protected from '@/components/Protected';
import { Button, ErrorState, FormField, Input, PageHeader, Section } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { apiPost } from '@/lib/api';
import { getFirebaseAuth } from '@/lib/firebase';

function AccountSettingsInner() {
  const { profile, activeTenantId, activeMembership, refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function savePassword() {
    setErr(null);
    setMessage(null);
    if (password.length < 8) {
      setErr('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) {
      setErr('You need to sign in again before changing your password.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(user, password);
      await apiPost('/auth/password-changed', {}, activeTenantId);
      setPassword('');
      setConfirm('');
      setMessage('Password changed.');
      await refresh();
    } catch (e) {
      const raw = (e as Error).message || 'Could not change password.';
      setErr(
        raw.includes('requires-recent-login')
          ? 'Firebase needs a fresh sign-in before changing this password. Log out, sign in again, then retry.'
          : raw,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Account Settings"
        subtitle={profile ? `${profile.fullName} · ${profile.email}` : 'Manage your sign-in settings'}
      />

      <div className="space-y-6">
        {activeMembership?.mustChangePassword && (
          <div className="rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-body-sm text-warning-fg">
            You are signed in with a temporary password. Change it before continuing regular work.
          </div>
        )}
        {err && <ErrorState message={err} />}
        {message && <div className="rounded-md border border-success/30 bg-success-bg px-4 py-3 text-body-sm text-success-fg">{message}</div>}

        <Section
          title="Password"
          action={
            <Button icon={Save} onClick={savePassword} loading={saving} disabled={!password || !confirm}>
              Save password
            </Button>
          }
        >
          <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
            <FormField label="New password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </FormField>
            <FormField label="Confirm password" required>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat password"
              />
            </FormField>
          </div>
        </Section>

        <Section title="Preferences">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="font-medium text-ink">Notification preferences</div>
              <div className="text-body-sm text-ink-soft">Choose in-app, email, SMS, and WhatsApp delivery.</div>
            </div>
            <Link
              href="/settings/notifications"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-body-sm font-medium text-ink-muted hover:border-primary hover:text-primary"
            >
              <KeyRound className="h-4 w-4" /> Open preferences
            </Link>
          </div>
        </Section>
      </div>
    </>
  );
}

export default function AccountSettingsPage() {
  return (
    <Protected>
      <AccountSettingsInner />
    </Protected>
  );
}
