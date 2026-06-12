import { PageHeader } from '@/components/ui';
import { PackageList } from './package-list';

export default function ServicePackagesPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Service Packages"
        subtitle="Manage bundled packages and health checkup plans"
      />
      <div className="flex-1 p-6">
        <PackageList />
      </div>
    </div>
  );
}
