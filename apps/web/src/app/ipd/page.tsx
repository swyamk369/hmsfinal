'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function IpdPage() {
  return (
    <Protected requireModule="IPD" allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}>
      <RoleHome title="Inpatient (IPD)" subtitle="Bed occupancy and admissions">
        <PhasePlaceholder module="IPD" phase="Phase 10/13">
          Ward / bed management, admissions, rounds, charges, and discharge summaries are built here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
