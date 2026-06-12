'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';
import { AuthSplit, authInputCls } from '@/components/patient/auth-split';

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
      const { signInWithEmailAndPassword, signOut } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, email.trim(), password);

      try {
        const { portalApi } = await import('@/lib/patient-portal');
        await portalApi.me();
      } catch (apiErr: any) {
        if (apiErr.message?.includes('Staff accounts')) {
          await signOut(auth);
          setErr('Staff accounts cannot access the patient portal.');
          return;
        }
      }

      router.replace('/patient/dashboard');
    } catch (e) {
      setErr(friendly((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplit
      title="Sign in to your patient portal"
      subtitle="Secure access to your appointments, bills, and medical records."
    >
      {err && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
          <div className="text-body-sm text-danger-fg">{err}</div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-label-md text-ink">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputCls}
            placeholder="you@email.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-label-md text-ink">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputCls}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-label-md font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'} {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      <div className="mt-6 border-t border-line pt-5 text-center text-body-sm text-ink-muted">
        New here?{' '}
        <Link href="/patient/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </div>
      <p className="mt-3 text-center text-body-sm text-ink-soft">
        Looking to book?{' '}
        <Link href="/doctors" className="font-medium text-primary hover:underline">
          Find a doctor
        </Link>
      </p>
    </AuthSplit>
  );
}

function friendly(raw: string): string {
  if (raw.includes('invalid-credential') || raw.includes('wrong-password') || raw.includes('user-not-found'))
    return 'Incorrect email or password.';
  if (raw.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.';
  if (raw.includes('network')) return 'Network error. Check your connection.';
  return 'Unable to sign in. Please try again.';
}
