'use client';

import Protected from '@/components/Protected';
import { HelpTip } from '@/components/operations';
import { PageHeader, Section, Badge } from '@/components/ui';

const ROLES = [
  ['Hospital Admin', 'Full tenant configuration, staff, setup, modules, and operational oversight.'],
  ['Manager', 'Cross-department visibility and reports without most destructive defaults.'],
  ['Reception', 'Patient search/registration, appointments, check-in, queue, and basic billing.'],
  ['Doctor', 'Consultations, clinical notes, vitals, diagnosis, prescriptions, lab ordering, OPD/IPD clinical view.'],
  ['Nurse', 'Nursing dashboard, vitals, notes, medication administration, IPD care.'],
  ['Lab Tech', 'Lab queue, sample collection, result entry, verification, report printing.'],
  ['Pharmacist', 'Prescription queue, stock-aware dispense, returns, and pharmacy billing.'],
  ['Inventory Manager', 'Items, suppliers, procurement, stock-in, adjustments, expiry and ledger.'],
  ['Billing / Accountant', 'Bills, receipts, refunds, receivables, insurance-linked balances, financial reports.'],
  ['Insurance Staff', 'Policies, claims, approvals/rejections, settlements, and receivables.'],
];

export default function RoleSupportPage() {
  return (
    <Protected>
      <PageHeader title="Role Access" subtitle="Understand why screens and buttons appear or disappear" />
      <div className="space-y-6">
        <HelpTip title="Per-hospital access">
          Roles and permissions are tenant-scoped. Hospital A and Hospital B can use different permission patterns, so
          access should be reviewed in the hospital’s Admin Roles area before changing code.
        </HelpTip>

        <Section title="Common role intent">
          <div className="divide-y divide-line">
            {ROLES.map(([role, text]) => (
              <div key={role} className="grid gap-3 px-5 py-4 md:grid-cols-[220px_1fr]">
                <div>
                  <Badge tone="primary">{role}</Badge>
                </div>
                <p className="text-body-sm text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Permission errors">
          <div className="space-y-3 p-5 text-body-sm text-ink-muted">
            <p>
              A message like <span className="font-mono text-ink">Missing permission: lab.report.print</span> means the
              module is available, but your role does not have that action.
            </p>
            <p>
              Example: doctors may read lab results for clinical decisions, while only lab users or admins may print the
              official lab report depending on hospital policy.
            </p>
            <p>
              If the task belongs to your job, ask a Hospital Admin to update the role permission set for this tenant.
            </p>
          </div>
        </Section>
      </div>
    </Protected>
  );
}
