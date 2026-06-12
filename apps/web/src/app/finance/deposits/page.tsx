import { PageHeader } from '@/components/ui';
import { DepositsList } from './deposits-list';

export default function DepositsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Advance Deposits"
        subtitle="Manage patient advance payments and balances"
      />
      <div className="flex-1 p-6">
        <DepositsList />
      </div>
    </div>
  );
}
