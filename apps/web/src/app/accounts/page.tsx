'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function AccountsPage() {
  return (
    <Protected requireModule="BILLING" allowedRoles={['ACCOUNTANT', 'HOSPITAL_ADMIN']}>
      <RoleHome title="Accounts" subtitle="Financial reports, refunds, reconciliation">
        <PhasePlaceholder module="BILLING" phase="Phase 7/12">
          Financial reporting, refunds, and reconciliation are built here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
