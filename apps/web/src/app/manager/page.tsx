'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function ManagerPage() {
  return (
    <Protected allowedRoles={['HOSPITAL_MANAGER', 'HOSPITAL_ADMIN']}>
      <RoleHome title="Operations" subtitle="Hospital-wide monitoring and reports">
        <PhasePlaceholder module="REPORTS" phase="Phase 12">
          Operational, clinical, and financial summaries (read-only) live here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
