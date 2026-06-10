'use client';

import Protected from '@/components/Protected';
import { HelpTip } from '@/components/operations';
import { PageHeader, Section } from '@/components/ui';

const WORKFLOWS = [
  ['Reception', 'Search patient, register only if no match, book or check in, confirm department/provider, issue token.'],
  ['OPD doctor', 'Start checked-in encounter, record vitals/notes/diagnosis, add prescription or lab order, finalize consultation.'],
  ['Lab', 'Collect sample, move to processing, enter result, verify abnormal values, print or share report.'],
  ['Pharmacy', 'Open finalized prescription, check available stock, dispense FEFO batches, mark partial only when stock is missing.'],
  ['Inventory', 'Create supplier/item, raise PO, receive goods into batches, review low stock and expiry, adjust with reason only.'],
  ['IPD and nursing', 'Admit to available bed, record rounds/vitals/notes/MAR, post charges, discharge and print summary.'],
  ['Billing', 'Create bill from services or workflow charges, collect payment, print invoice/receipt, refund/cancel with reason.'],
  ['Insurance', 'Attach patient policy, create claim from bill, submit/review/approve/reject, settle approved claim.'],
];

export default function WorkflowSupportPage() {
  return (
    <Protected>
      <PageHeader title="Workflow Guides" subtitle="Short operating notes for the core hospital flow" />
      <div className="space-y-6">
        <HelpTip title="How to use workflows">
          Each workflow has a real API and audit trail behind it. If a button is hidden, check your role permission and
          whether the hospital has that module enabled.
        </HelpTip>
        <Section title="Core workflows">
          <div className="divide-y divide-line">
            {WORKFLOWS.map(([title, text]) => (
              <div key={title} className="px-5 py-4">
                <h2 className="text-title-lg text-ink">{title}</h2>
                <p className="mt-1 text-body-sm text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Completion standard">
          <ul className="grid gap-2 p-5 text-body-sm text-ink-muted md:grid-cols-2">
            <li>API, UI, RBAC, tenant isolation, and module entitlement must all pass.</li>
            <li>Important actions must audit the actor, entity, and reason where required.</li>
            <li>Print/export views should be used for invoices, lab reports, discharge summaries, and reports.</li>
            <li>Patient timeline and journey should reflect the real flow, not a manual side note.</li>
          </ul>
        </Section>
      </div>
    </Protected>
  );
}
