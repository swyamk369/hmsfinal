'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle, ChevronDown, CalendarDays, Building2, FileText, ShieldCheck } from 'lucide-react';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I book an appointment?',
    a: 'Go to Find a Doctor, choose a doctor, pick an available time, and confirm. You can also book from a hospital’s page. Your appointment then appears under Appointments.',
  },
  {
    q: 'Why can’t I see my reports or documents?',
    a: 'For your privacy, hospitals control what is shared. Only documents a hospital has explicitly published to your portal are shown. If something is missing, contact that hospital directly.',
  },
  {
    q: 'I have records at more than one hospital — how does that work?',
    a: 'You have one login, but each hospital keeps a separate record. Use the hospital switcher (top bar) or the Hospitals page to choose which hospital’s records you’re viewing. Records are never shared between hospitals.',
  },
  {
    q: 'How do I pay a bill?',
    a: 'Payments are handled at the clinic. Your portal shows what’s outstanding so you can pay in person or contact the hospital’s billing desk.',
  },
  {
    q: 'How do I request a prescription refill?',
    a: 'Open Prescriptions, find the medication, and request a refill. Your request is sent to the hospital’s pharmacy team for review — you’ll get a notification when its status changes.',
  },
  {
    q: 'How do I link an existing hospital record?',
    a: 'Go to Settings → Hospital Records (or the Hospitals page) and choose “Link another hospital record”. Verify with your MRN or registered mobile; the hospital reviews and approves the link.',
  },
];

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-headline-md text-ink">Help &amp; Support</h1>
      <p className="mb-6 text-body-sm text-ink-muted">Answers to common questions, and how to get help.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Quick icon={CalendarDays} title="Manage appointments" body="Book, view, or add appointments to your calendar." href="/patient/appointments" />
        <Quick icon={FileText} title="Your documents" body="View reports and documents hospitals share with you." href="/patient/documents" />
        <Quick icon={Building2} title="Your hospitals" body="Switch between or link hospital records." href="/patient/hospitals" />
        <Quick icon={ShieldCheck} title="Privacy & security" body="Manage your password and notification settings." href="/patient/settings" />
      </div>

      <section className="rounded-xl border border-line bg-surface">
        <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-headline-sm text-ink">
          <HelpCircle className="h-5 w-5 text-primary" /> Frequently asked questions
        </h2>
        <ul className="divide-y divide-line">
          {FAQS.map((f, i) => (
            <li key={f.q}>
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
                <span className="font-medium text-ink">{f.q}</span>
                <ChevronDown className={`h-5 w-5 flex-shrink-0 text-ink-soft transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && <p className="px-5 pb-4 text-body-md text-ink-muted">{f.a}</p>}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 rounded-xl border border-line bg-canvas p-5 text-body-sm text-ink-muted">
        Still need help? For anything about your medical records, bills, or appointments, please contact the
        relevant hospital directly — you’ll find their details on each <Link href="/hospitals" className="font-medium text-primary hover:underline">hospital’s page</Link>.
      </div>
    </div>
  );
}

function Quick({ icon: Icon, title, body, href }: { icon: typeof HelpCircle; title: string; body: string; href: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-primary-50 text-primary"><Icon className="h-5 w-5" /></span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="text-body-sm text-ink-muted">{body}</p>
      </div>
    </Link>
  );
}
