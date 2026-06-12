import { PageHeader } from '@/components/ui';
import Protected from '@/components/Protected';
import { PackageList } from './package-list';
import { FinanceShell } from '../finance-ui';

export default function ServicePackagesPage() {
  return (
    <Protected requireModule="BILLING" requirePermission={['finance.charge.manage', 'bill.write', 'settings.manage']}>
      <PageHeader title="Service Packages" subtitle="Manage bundled packages and health checkup plans" />
      <FinanceShell>
        <PackageList />
      </FinanceShell>
    </Protected>
  );
}
