'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function DashboardPage() {
  return (
    <Protected>
      <RoleHome title="Dashboard">
        <PhasePlaceholder module="WORKSPACE" phase="upcoming phases">
          Role-specific operational widgets appear here as each module is built out.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
