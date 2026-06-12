import { PageHeader } from '@/components/ui';
import Protected from '@/components/Protected';
import { TariffList } from './tariff-list';
import { FinanceShell } from '../finance-ui';

export default function TariffsPage() {
  return (
    <Protected requireModule="BILLING" requirePermission={['finance.charge.manage', 'bill.write', 'settings.manage']}>
      <PageHeader title="Price Lists & Tariffs" subtitle="Manage service pricing across different schemes and panels" />
      <FinanceShell>
        <TariffList />
      </FinanceShell>
    </Protected>
  );
}
