'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function ReportsPage() {
  return (
    <Protected requireModule="REPORTS" allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'ACCOUNTANT']}>
      <RoleHome title="Reports" subtitle="Operational, clinical, financial, and inventory analytics">
        <PhasePlaceholder module="REPORTS" phase="Phase 12">
          Cross-module dashboards and exportable reports are built here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
