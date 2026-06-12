'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { HeartPulse, ShieldCheck, FolderLock, Building2 } from 'lucide-react';

/**
 * HealthConnect split auth layout: left = form panel, right = brand/trust panel.
 * The right panel is a styled gradient (no stock imagery — we have none) carrying
 * real trust messaging. Mobile shows only the form.
 */
export function AuthSplit({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-surface">
      <div className="flex w-full flex-col justify-center overflow-y-auto px-6 py-10 lg:w-5/12 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-headline-sm font-semibold text-primary">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            HealthConnect
          </Link>
          <h1 className="text-headline-md text-ink">{title}</h1>
          <p className="mt-1 text-body-md text-ink-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-700 via-primary to-primary-600 lg:flex lg:w-7/12">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute bottom-10 left-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex w-full flex-col justify-center px-16">
          <div className="max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md">
            <div className="mb-3 flex items-center gap-2 text-white">
              <ShieldCheck className="h-6 w-6" />
              <h2 className="text-headline-sm">Your health data, protected</h2>
            </div>
            <p className="text-body-md leading-relaxed text-white/90">
              One secure login for every hospital you visit. Your records stay isolated per hospital and are never
              shared between them — accessible only to you and your authorised care team.
            </p>
            <ul className="mt-6 space-y-3 text-body-sm text-white/90">
              <Trust icon={FolderLock} text="Encrypted records, hospital by hospital" />
              <Trust icon={Building2} text="Manage appointments & bills across hospitals" />
              <Trust icon={ShieldCheck} text="Strict medical-privacy isolation (RLS)" />
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Trust({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-white/15">
        <Icon className="h-4 w-4" />
      </span>
      {text}
    </li>
  );
}

export const authInputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-body-md text-ink placeholder:text-ink-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
