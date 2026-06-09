'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldPlus, AlertCircle } from 'lucide-react';
import { useAuth, landingPath } from '@/lib/auth-context';
import { Button, FormField, Input } from '@/components/ui';

export default function LoginPage() {
  const { profile, loading, activeTenantId, firebaseLogin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && profile) router.replace(landingPath(profile, activeTenantId));
  }, [loading, profile, activeTenantId, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await firebaseLogin(email, password);
    } catch (e) {
      setErr(friendlyAuthError((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-xl border border-line bg-surface">
            <ShieldPlus className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-display-lg text-ink">HMS Enterprise</h1>
          <p className="mt-1 text-body-md text-ink-muted">Secure Authentication Portal</p>
        </div>

        <div className="card p-6 shadow-raised">
          {err && (
            <div className="mb-5 flex items-start gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
              <div>
                <div className="text-body-md font-semibold text-danger">Sign-in failed</div>
                <div className="text-body-sm text-danger-fg">{err}</div>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <FormField label="Work Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.org"
                autoComplete="username"
                required
              />
            </FormField>

            <FormField label="Password" required>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="sr-only">Password</span>
                <Link href="/forgot-password" className="ml-auto text-body-sm font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                required
              />
            </FormField>

            <Button type="submit" className="w-full" loading={busy} disabled={busy || !email || !password}>
              {busy ? 'Authenticating…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 border-t border-line pt-4 text-center text-body-sm text-ink-muted">
            Need technical assistance? <span className="font-medium text-primary">Contact IT Support</span>
          </div>
        </div>

        <p className="mt-6 text-center text-body-sm text-ink-soft">
          © {new Date().getFullYear()} HMS Enterprise. Unauthorized access is strictly prohibited.
        </p>
      </div>
    </div>
  );
}

function friendlyAuthError(raw: string): string {
  if (
    raw.includes('auth/invalid-credential') ||
    raw.includes('auth/wrong-password') ||
    raw.includes('auth/user-not-found')
  ) {
    return 'The email or password you entered is incorrect. Please verify your details and try again.';
  }
  if (raw.includes('auth/too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
  if (raw.includes('auth/network-request-failed')) return 'Network error. Check your connection and try again.';
  if (raw.includes('not configured')) return raw;
  return 'Unable to sign in. Please try again.';
}
