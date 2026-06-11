'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, AlertCircle } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';

export default function PatientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth) {
      setErr('Sign-in is not available right now.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/patient/dashboard');
    } catch (e) {
      setErr(friendly((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-xl bg-primary text-white">
            <HeartPulse className="h-8 w-8" />
          </div>
          <h1 className="text-display-lg text-ink">Patient Portal</h1>
          <p className="mt-1 text-body-md text-ink-muted">Sign in to view your appointments, bills & reports.</p>
        </div>
        <div className="card p-6 shadow-raised">
          {err && (
            <div className="mb-5 flex items-start gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
              <div className="text-body-sm text-danger-fg">{err}</div>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-body-sm font-medium text-ink">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={cls} placeholder="you@email.com" />
            </div>
            <div>
              <label className="mb-1 block text-body-sm font-medium text-ink">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={cls} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="mt-5 border-t border-line pt-4 text-center text-body-sm text-ink-muted">
            New here?{' '}
            <Link href="/patient/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-body-sm text-ink-soft">
          Looking to book?{' '}
          <Link href="/doctors" className="font-medium text-primary hover:underline">
            Find a doctor
          </Link>
        </p>
      </div>
    </div>
  );
}

const cls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none';

function friendly(raw: string): string {
  if (raw.includes('invalid-credential') || raw.includes('wrong-password') || raw.includes('user-not-found')) return 'Incorrect email or password.';
  if (raw.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.';
  if (raw.includes('network')) return 'Network error. Check your connection.';
  return 'Unable to sign in. Please try again.';
}
