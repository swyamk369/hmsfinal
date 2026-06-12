'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Stethoscope,
  HeartPulse,
  FlaskConical,
  Pill,
  Package,
  BedDouble,
  Receipt,
  Calculator,
  ShieldCheck,
  BarChart3,
  Settings2,
  Building2,
  Layers,
  ScrollText,
  Settings,
  LifeBuoy,
  ShieldPlus,
  ListChecks,
  Menu,
  Search,
  ChevronDown,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS, SEGMENT_LABELS, type NavItem } from '@/lib/constants';
import { visibleNav, breadcrumbs } from '@/lib/access';
import NotificationBell from './notification-bell';
import { cx } from './ui';
import { AiChatbot } from './shared/ai-chatbot';

const ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboard,
  '/manager': BarChart3,
  '/reception': ClipboardList,
  '/opd': ListChecks,
  '/patients': Users,
  '/doctor': Stethoscope,
  '/nursing': HeartPulse,
  '/lab': FlaskConical,
  '/pharmacy': Pill,
  '/inventory': Package,
  '/ipd': BedDouble,
  '/finance': Calculator,
  '/billing': Receipt,
  '/accounts': Calculator,
  '/insurance': ShieldCheck,
  '/reports': BarChart3,
  '/admin': Settings2,
  '/platform': Building2,
  '/platform/plans': Layers,
  '/platform/audit': ScrollText,
};

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const Icon = ICONS[item.href] ?? LayoutDashboard;
  const active = pathname === item.href || (item.href !== '/platform' && pathname.startsWith(item.href + '/'));
  return (
    <Link href={item.href} onClick={onNavigate} className={cx('nav-item', active && 'nav-item-active')}>
      <Icon className="h-[18px] w-[18px]" />
      {item.label}
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, activeMembership } = useAuth();
  if (!profile) return null;

  const items = visibleNav(profile, activeMembership);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink900 text-white">
          <ShieldPlus className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-title-lg leading-tight text-ink">HMS Portal</div>
          <div className="truncate text-body-sm text-ink-soft">
            {profile.isPlatform ? 'Platform Console' : (activeMembership?.tenantName ?? 'Hospital')}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((i) => (
          <NavLink key={i.href} item={i} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        <Link href="/settings/account" onClick={onNavigate} className="nav-item">
          <Settings className="h-[18px] w-[18px]" /> Settings
        </Link>
        <Link href="/support" onClick={onNavigate} className="nav-item">
          <LifeBuoy className="h-[18px] w-[18px]" /> Support
        </Link>
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = breadcrumbs(pathname, SEGMENT_LABELS);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-body-sm text-ink-soft sm:flex">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-ink-soft/60" />}
            {last ? (
              <span className="truncate font-medium text-ink">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate hover:text-primary">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
      }}
      className="hidden md:block"
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          aria-label="Global search"
          className="w-44 rounded-full border border-line bg-canvas py-1.5 pl-8 pr-3 text-body-sm focus:w-56 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </form>
  );
}

function TenantSelector() {
  const { profile, activeTenantId, setActiveTenant } = useAuth();
  if (!profile || profile.isPlatform || profile.tenants.length === 0) return null;
  if (profile.tenants.length === 1) {
    return (
      <span className="hidden items-center gap-2 rounded-md border border-line px-3 py-1.5 text-body-sm text-ink-muted sm:inline-flex">
        {profile.tenants[0].tenantName}
      </span>
    );
  }
  return (
    <select
      className="rounded-md border border-line bg-surface px-3 py-1.5 text-body-sm"
      value={activeTenantId ?? ''}
      onChange={(e) => setActiveTenant(e.target.value)}
      aria-label="Active hospital"
    >
      {profile.tenants.map((t) => (
        <option key={t.tenantId} value={t.tenantId}>
          {t.tenantName}
        </option>
      ))}
    </select>
  );
}

function ProfileMenu() {
  const { profile, activeMembership, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!profile) return null;

  const roleLabel = profile.isPlatform
    ? 'Super Admin'
    : (activeMembership?.roles ?? []).map((r) => ROLE_LABELS[r] ?? r).join(', ') || 'No role';
  const initials = profile.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function onLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-canvas"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-100 text-body-sm font-semibold text-primary-700">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-body-sm font-medium text-ink">{profile.fullName}</span>
          <span className="block text-label-sm uppercase text-ink-soft">{roleLabel}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-ink-soft" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-line bg-surface shadow-raised">
            <div className="border-b border-line px-4 py-3">
              <div className="text-body-sm font-medium text-ink">{profile.fullName}</div>
              <div className="truncate text-body-sm text-ink-soft">{profile.email}</div>
            </div>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-body-sm text-ink hover:bg-canvas"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[260px] flex-shrink-0 border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] border-r border-line bg-surface">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-md p-1.5 text-ink-muted hover:bg-canvas lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-title-lg font-semibold text-ink sm:hidden">HMS</span>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <GlobalSearch />
            <NotificationBell />
            <TenantSelector />
            <ProfileMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
