import { PageHeader } from '@/components/ui';
import Protected from '@/components/Protected';
import { DepositsList } from './deposits-list';
import { FinanceShell } from '../finance-ui';

export default function DepositsPage() {
  return (
    <Protected
      requireModule="BILLING"
      requirePermission={['finance.patient_account.read', 'finance.cashier', 'payment.collect']}
    >
      <PageHeader title="Advance Deposits" subtitle="Manage patient advance payments and balances" />
      <FinanceShell>
        <DepositsList />
      </FinanceShell>
    </Protected>
  );
}
