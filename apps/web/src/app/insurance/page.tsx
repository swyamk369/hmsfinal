'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function InsurancePage() {
  return (
    <Protected requireModule="INSURANCE" allowedRoles={['INSURANCE_STAFF', 'BILLING', 'HOSPITAL_ADMIN']}>
      <RoleHome title="Insurance" subtitle="Policies, claims, and settlements">
        <PhasePlaceholder module="INSURANCE" phase="Phase 11/14">
          Providers, patient policies, claim lifecycle, patient-share calculation, and settlements are built here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
