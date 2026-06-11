'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase';
import { AuthSplit, authInputCls } from '@/components/patient/auth-split';

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
    <AuthSplit title="Create your account" subtitle="One secure login for every hospital you visit.">
      {err && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
          <div className="text-body-sm text-danger-fg">{err}</div>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-label-md text-ink">Full name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={authInputCls} placeholder="Your name" />
        </div>
        <div>
          <label className="mb-1.5 block text-label-md text-ink">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInputCls} placeholder="you@email.com" />
        </div>
        <div>
          <label className="mb-1.5 block text-label-md text-ink">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={authInputCls} placeholder="At least 6 characters" />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-label-md font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create account'} {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      <div className="mt-6 border-t border-line pt-5 text-center text-body-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/patient/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </AuthSplit>
  );
}

function friendly(raw: string): string {
  if (raw.includes('email-already-in-use')) return 'An account with this email already exists. Try signing in.';
  if (raw.includes('invalid-email')) return 'Please enter a valid email address.';
  if (raw.includes('weak-password')) return 'Please choose a stronger password.';
  return 'Unable to create your account. Please try again.';
}
