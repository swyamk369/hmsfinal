'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function NursingPage() {
  return (
    <Protected allowedRoles={['NURSE', 'HOSPITAL_ADMIN']}>
      <RoleHome title="Nursing" subtitle="Assigned patients, vitals, and IPD care">
        <PhasePlaceholder module="OPD" phase="Phase 6/10">
          Vitals entry, nursing notes, and medication administration are built here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
