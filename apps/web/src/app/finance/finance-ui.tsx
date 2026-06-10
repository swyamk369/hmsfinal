'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Banknote, ClipboardCheck, CreditCard, FileText, LayoutDashboard, ListChecks, Receipt, ShieldCheck, Users, Wallet } from 'lucide-react';
import { getActiveMembership } from '@/lib/access';
import { useAuth } from '@/lib/auth-context';
import { money, formatDateTime } from '@/lib/format';
import { outstanding, type Bill } from '@/lib/billing';
import type { BillableCharge } from '@/lib/finance';
import { Badge, Button, Section, StatusChip, cx } from '@/components/ui';

export const FINANCE_PERMS = ['finance.read', 'bill.read', 'payment.collect', 'reports.financial.read'];

const TABS = [
  { href: '/finance', label: 'Dashboard', icon: LayoutDashboard, permission: FINANCE_PERMS },
  { href: '/finance/cashier', label: 'Cashier', icon: CreditCard, permission: ['finance.cashier', 'payment.collect'] },
  { href: '/finance/bills', label: 'Bills', icon: Receipt, permission: ['finance.read', 'bill.read'] },
  { href: '/finance/patient-accounts', label: 'Patient Accounts', icon: Wallet, permission: ['finance.patient_account.read', 'bill.read'] },
  { href: '/finance/pending-charges', label: 'Pending Charges', icon: ListChecks, permission: ['finance.charge.manage', 'bill.write'] },
  { href: '/finance/leakage', label: 'Revenue Leakage', icon: AlertTriangle, permission: FINANCE_PERMS },
  { href: '/finance/payments', label: 'Payments', icon: Banknote, permission: ['finance.reconcile', 'reports.financial.read', 'finance.read'] },
  { href: '/finance/refunds', label: 'Refunds', icon: FileText, permission: ['payment.refund', 'finance.reconcile'] },
  { href: '/finance/insurance-receivables', label: 'Insurance', icon: ShieldCheck, permission: ['insurance.read', 'reports.financial.read'] },
  { href: '/finance/day-close', label: 'Day Close', icon: ClipboardCheck, permission: ['finance.day_close', 'finance.reconcile'] },
  { href: '/finance/approvals', label: 'Approvals', icon: Users, permission: ['finance.approval.manage'] },
  { href: '/finance/reports', label: 'Reports', icon: FileText, permission: ['reports.financial.read', 'finance.reconcile', 'finance.read'] },
];

export function FinanceTabs() {
  const pathname = usePathname();
  const { profile, activeTenantId } = useAuth();
  const permissions = new Set(getActiveMembership(profile, activeTenantId)?.permissions ?? []);
  const tabs = TABS.filter((tab) => tab.permission.some((p) => permissions.has(p)));
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line pb-px">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href || (tab.href !== '/finance' && pathname.startsWith(`${tab.href}/`));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cx(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-body-sm font-medium',
              active ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function FinanceShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FinanceTabs />
      {children}
    </>
  );
}

export function ChargeTable({
  charges,
  selected,
  onToggle,
}: {
  charges: BillableCharge[];
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className="border-b border-line text-label-md uppercase text-ink-soft">
            {onToggle && <th className="px-5 py-3 font-medium">Select</th>}
            <th className="px-5 py-3 font-medium">Patient</th>
            <th className="px-5 py-3 font-medium">Charge</th>
            <th className="px-5 py-3 font-medium">Source</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {charges.map((charge) => (
            <tr key={charge.id} className="hover:bg-canvas">
              {onToggle && (
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selected?.has(charge.id) ?? false}
                    onChange={() => onToggle(charge.id)}
                  />
                </td>
              )}
              <td className="px-5 py-3">
                <div className="font-medium text-ink">{charge.patient?.fullName ?? 'Patient'}</div>
                <div className="text-label-sm text-ink-soft">{charge.patient?.mrn ?? charge.patientId}</div>
              </td>
              <td className="px-5 py-3">
                <div className="font-medium text-ink">{charge.name}</div>
                <div className="text-label-sm text-ink-soft">
                  {charge.quantity} × {money(charge.unitPrice)} · {formatDateTime(charge.createdAt)}
                </div>
              </td>
              <td className="px-5 py-3">
                <Badge tone="primary">{charge.sourceModule}</Badge>
                <div className="mt-1 text-label-sm text-ink-soft">{charge.sourceType}</div>
              </td>
              <td className="px-5 py-3 text-right font-medium text-ink">{money(charge.total)}</td>
              <td className="px-5 py-3">
                <StatusChip status={charge.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BillTable({ bills }: { bills: Bill[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-body-sm">
        <thead>
          <tr className="border-b border-line text-label-md uppercase text-ink-soft">
            <th className="px-5 py-3 font-medium">Bill</th>
            <th className="px-5 py-3 font-medium">Patient</th>
            <th className="px-5 py-3 text-right font-medium">Net</th>
            <th className="px-5 py-3 text-right font-medium">Due</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {bills.map((bill) => (
            <tr key={bill.id} className="hover:bg-canvas">
              <td className="px-5 py-3">
                <Link href={`/finance/bills/${bill.id}`} className="font-mono text-primary hover:underline">
                  {bill.billNumber}
                </Link>
                <div className="text-label-sm text-ink-soft">{formatDateTime(bill.createdAt)}</div>
              </td>
              <td className="px-5 py-3 font-medium text-ink">{bill.patient?.fullName ?? bill.patientId}</td>
              <td className="px-5 py-3 text-right font-medium text-ink">{money(bill.netAmount)}</td>
              <td className="px-5 py-3 text-right font-medium text-ink">{money(outstanding(bill))}</td>
              <td className="px-5 py-3">
                <StatusChip status={bill.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinanceQuickActions() {
  return (
    <Section title="Quick actions">
      <div className="flex flex-wrap gap-2 p-5">
        <Link href="/finance/cashier">
          <Button variant="ghost" icon={CreditCard}>Collect payment</Button>
        </Link>
        <Link href="/finance/pending-charges">
          <Button variant="ghost" icon={ListChecks}>Create bill from charges</Button>
        </Link>
        <Link href="/finance/day-close">
          <Button variant="ghost" icon={ClipboardCheck}>Close day</Button>
        </Link>
        <Link href="/finance/approvals">
          <Button variant="ghost" icon={Users}>Approvals</Button>
        </Link>
      </div>
    </Section>
  );
}
