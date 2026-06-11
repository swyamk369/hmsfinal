'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, AlertCircle } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';

export default function PatientRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setErr('Sign-up is not available right now.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
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
          <h1 className="text-display-lg text-ink">Create your account</h1>
          <p className="mt-1 text-body-md text-ink-muted">One login for all your linked hospitals.</p>
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
              <label className="mb-1 block text-body-sm font-medium text-ink">Full name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={cls} placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1 block text-body-sm font-medium text-ink">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={cls} placeholder="you@email.com" />
            </div>
            <div>
              <label className="mb-1 block text-body-sm font-medium text-ink">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={cls} placeholder="At least 6 characters" />
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <div className="mt-5 border-t border-line pt-4 text-center text-body-sm text-ink-muted">
            Already have an account?{' '}
            <Link href="/patient/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const cls = 'w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-md text-ink focus:border-primary focus:outline-none';

function friendly(raw: string): string {
  if (raw.includes('email-already-in-use')) return 'An account with this email already exists. Try signing in.';
  if (raw.includes('invalid-email')) return 'Please enter a valid email address.';
  if (raw.includes('weak-password')) return 'Please choose a stronger password.';
  return 'Unable to create your account. Please try again.';
}
