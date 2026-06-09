'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function PharmacyPage() {
  return (
    <Protected requireModule="PHARMACY" allowedRoles={['PHARMACIST', 'HOSPITAL_ADMIN']}>
      <RoleHome title="Pharmacy" subtitle="Prescriptions to dispense">
        <PhasePlaceholder module="PHARMACY" phase="Phase 8">
          Finalized prescriptions, inventory availability checks, FEFO dispensing, and pharmacy billing are built here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
