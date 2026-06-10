'use client';

import Link from 'next/link';
import { BookOpen, LifeBuoy, Route, ShieldCheck, Stethoscope } from 'lucide-react';
import Protected from '@/components/Protected';
import { HelpTip } from '@/components/operations';
import { PageHeader, Section } from '@/components/ui';

const CARDS = [
  {
    href: '/support/workflows',
    title: 'Workflow guides',
    body: 'Step-by-step SOPs for reception, OPD, lab, pharmacy, IPD, billing, insurance, and inventory.',
    icon: Route,
  },
  {
    href: '/support/roles',
    title: 'Role access',
    body: 'What each staff role can usually see and why a permission error may appear.',
    icon: ShieldCheck,
  },
  {
    href: '/support/troubleshooting',
    title: 'Troubleshooting',
    body: 'Fast checks for stuck patients, blocked bills, missing stock, rejected claims, and failed notifications.',
    icon: LifeBuoy,
  },
];

export default function SupportPage() {
  return (
    <Protected>
      <PageHeader title="Support" subtitle="Operational help for hospital staff" />
      <div className="space-y-6">
        <HelpTip title="Use this during live work">
          These notes explain the intended workflow and common blockers. They do not bypass permissions; hospital admins
          manage access from Admin Roles.
        </HelpTip>

        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="card p-5 hover:border-primary/50">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="mt-3 text-title-lg text-ink">{card.title}</h2>
                <p className="mt-1 text-body-sm text-ink-muted">{card.body}</p>
              </Link>
            );
          })}
        </div>

        <Section title="Fast orientation">
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <SupportNote title="Start with the queue" text="Role dashboards now show live next actions. If something is missing, check module entitlement and role permissions." />
            <SupportNote title="Keep reasons specific" text="Transfers, refunds, cancellations, stock adjustments, and archive actions should describe the real-world reason." />
            <SupportNote title="Patient profile is the source" text="Use the patient journey strip to see current location, blockers, documents, open bills, lab orders, and prescriptions." />
            <SupportNote title="Escalate clinical blockers" text="Abnormal lab results, missed medications, allergy alerts, and delayed IPD discharge should be handled before routine work." />
          </div>
        </Section>

        <Section title="Need admin help?">
          <div className="flex items-start gap-3 p-5">
            <Stethoscope className="mt-0.5 h-5 w-5 text-primary" />
            <p className="text-body-sm text-ink-muted">
              Ask a Hospital Admin to review your role, department, provider profile, and enabled modules if the screen
              says you are missing access for a task that belongs to your job.
            </p>
          </div>
        </Section>
      </div>
    </Protected>
  );
}

function SupportNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2">
      <div className="flex items-center gap-2 text-body-sm font-medium text-ink">
        <BookOpen className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="mt-1 text-body-sm text-ink-muted">{text}</p>
    </div>
  );
}
