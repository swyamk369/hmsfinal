'use client';

import Protected from '@/components/Protected';
import RoleHome from '@/components/RoleHome';
import { PhasePlaceholder } from '@/components/ui';

export default function InventoryPage() {
  return (
    <Protected requireModule="INVENTORY" allowedRoles={['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN']}>
      <RoleHome title="Inventory" subtitle="Stock, batches, suppliers, and alerts">
        <PhasePlaceholder module="INVENTORY" phase="Phase 8/11">
          Item master, suppliers, stock-in / purchase orders, the transaction ledger, and low-stock / expiry alerts are
          built here.
        </PhasePlaceholder>
      </RoleHome>
    </Protected>
  );
}
