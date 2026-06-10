'use client';

import Protected from '@/components/Protected';
import { HelpTip } from '@/components/operations';
import { PageHeader, Section, Badge } from '@/components/ui';

const CHECKS = [
  ['Patient stuck in OPD', 'Check whether the encounter is CHECKED_IN or IN_PROGRESS, then open Doctor or OPD queue.'],
  ['Lab report not printable', 'Verify result entry and verification status, then confirm lab.report.print permission.'],
  ['Prescription not dispensing', 'Check finalized status, item stock, active batches, expiry, and partial dispense history.'],
  ['Stock looks wrong', 'Use inventory ledger first. Adjust only when the physical count is verified and a reason is documented.'],
  ['Bed not available', 'Check active admissions and transfers. A bed frees only after discharge completes.'],
  ['Bill cannot close', 'Review payments, refunds, insurance claim status, and outstanding patient share.'],
  ['Claim stuck', 'Open the claim detail and confirm submit/review/approve/reject/settle sequence and required reasons.'],
  ['Notification missing', 'Check notification preferences, recipient role, tenant scope, and delivery failure logs.'],
];

export default function TroubleshootingSupportPage() {
  return (
    <Protected>
      <PageHeader title="Troubleshooting" subtitle="Common operational blockers and where to look first" />
      <div className="space-y-6">
        <HelpTip title="Start from the work queue">
          The dashboard queue usually links directly to the blocked object. Open that first, then check status, module,
          role permission, and audit history.
        </HelpTip>

        <Section title="Common checks">
          <div className="divide-y divide-line">
            {CHECKS.map(([title, text]) => (
              <div key={title} className="grid gap-3 px-5 py-4 md:grid-cols-[220px_1fr]">
                <div>
                  <Badge tone="warning">{title}</Badge>
                </div>
                <p className="text-body-sm text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Escalation rule">
          <div className="p-5 text-body-sm text-ink-muted">
            If the record status looks correct but the action still fails, capture the exact error text, current tenant,
            patient or bill number, and timestamp. That gives admin/support enough context to check permissions, audit
            logs, and tenant module state without exposing unnecessary patient data.
          </div>
        </Section>
      </div>
    </Protected>
  );
}
