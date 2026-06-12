import { PageHeader } from '@/components/ui';
import { TariffList } from './tariff-list';

export default function TariffsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Price Lists & Tariffs"
        subtitle="Manage service pricing across different schemes and panels"
      />
      <div className="flex-1 p-6">
        <TariffList />
      </div>
    </div>
  );
}
