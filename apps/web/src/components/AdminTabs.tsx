'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cx } from './ui';

interface Tab {
  label: string;
  href: string;
  module?: string;
}

const TABS: Tab[] = [
  { label: 'Overview', href: '/admin' },
  { label: 'Profile', href: '/admin/profile' },
  { label: 'Facilities', href: '/admin/facilities' },
  { label: 'Departments', href: '/admin/departments' },
  { label: 'Staff', href: '/admin/staff' },
  { label: 'Roles', href: '/admin/roles' },
  { label: 'Catalog', href: '/admin/catalog' },
  { label: 'Wards & Beds', href: '/admin/wards', module: 'IPD' },
  { label: 'Lab Tests', href: '/admin/lab-catalog', module: 'LAB' },
  { label: 'Insurance', href: '/admin/insurance', module: 'INSURANCE' },
];

/** Sub-navigation for the Hospital Admin setup area. Module-gated tabs are hidden
 * unless the active tenant has the entitlement. */
export default function AdminTabs() {
  const pathname = usePathname();
  const { activeMembership } = useAuth();
  const modules = new Set(activeMembership?.modules ?? []);
  const tabs = TABS.filter((t) => !t.module || modules.has(t.module));

  return (
    <div className="mb-6 -mx-1 flex gap-1 overflow-x-auto border-b border-line pb-px">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cx(
              'whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-body-sm font-medium transition',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-muted hover:border-line hover:text-ink',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
