'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldPlus, MailCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button, FormField, Input, ErrorState } from '@/components/ui';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e) {
      // Don't reveal whether an account exists — show success regardless of not-found.
      const msg = (e as Error).message;
      if (msg.includes('auth/user-not-found')) setSent(true);
      else setErr('Could not send the reset email. Please try again.');
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
          <h1 className="text-headline-md text-ink">Reset your password</h1>
          <p className="mt-1 text-body-md text-ink-muted">We&apos;ll email you a secure reset link.</p>
        </div>

        <div className="card p-6 shadow-raised">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success-bg text-success-fg">
                <MailCheck className="h-6 w-6" />
              </div>
              <h2 className="text-title-lg text-ink">Check your inbox</h2>
              <p className="mt-1 text-body-sm text-ink-muted">
                If an account exists for <span className="font-medium text-ink">{email}</span>, a password reset link is
                on its way.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {err && <ErrorState message={err} />}
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
              <Button type="submit" className="w-full" loading={busy} disabled={busy || !email}>
                Send reset link
              </Button>
            </form>
          )}

          <div className="mt-5 border-t border-line pt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
