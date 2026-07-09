'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '../../../../libs/shared/utils';
import { usePathname } from 'next/navigation';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';
import { STEP_ORDER } from '@/lib/workflow/stepAccess';
import {
  FileText, Users, Package, Settings, LayoutDashboard,
  ClipboardList, FileSearch, ShoppingCart, PackageCheck,
  ReceiptText, Wallet, Building2, ChevronsLeft, ChevronsRight, Lock,
  AlertTriangle,
} from 'lucide-react';

const salesItems = [
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/items', label: 'Items', icon: Package },
];

const stepIcons: Record<string, React.ElementType> = {
  vendors: Building2,
  requisitions: ClipboardList,
  rfp: FileSearch,
  purchase_orders: ShoppingCart,
  grn: PackageCheck,
  vendor_invoices: ReceiptText,
  vendor_payments: Wallet,
};

const stepHrefs: Record<string, string> = {
  vendors: '/vendors',
  requisitions: '/requisitions',
  rfp: '/rfp',
  purchase_orders: '/purchase-orders',
  grn: '/grn',
  vendor_invoices: '/vendor-invoices',
  vendor_payments: '/vendor-payments',
};

const COLLAPSE_KEY = 'sidebar-collapsed';

function NavLink({
  href, label, icon: Icon, active, collapsed, locked,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; collapsed: boolean; locked?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? (locked ? `${label} — not started yet, view only` : label) : undefined}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-blue-50 text-[#0329c1]'
          : 'text-[#145d98] hover:bg-slate-50 hover:text-[#3b5bdb]'
      )}
    >
      <span className="relative">
        <Icon className={cn('w-4 h-4', active ? 'text-[#3b5bdb]' : 'text-[#4a7ab5]', locked && 'opacity-50')} />
        {locked && (
          <Lock className="w-2.5 h-2.5 absolute -bottom-1 -right-1 text-slate-400 bg-white rounded-full" />
        )}
      </span>
      {!collapsed && (
        <span className={cn(locked && 'text-slate-400')}>{label}</span>
      )}
      {!collapsed && locked && (
        <span className="ml-auto text-[10px] text-slate-300 font-normal">view only</span>
      )}
    </Link>
  );
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="my-3 border-t border-slate-100" />;
  return (
    <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { status } = useWorkflowStatus();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) setCollapsed(saved === 'true');
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      localStorage.setItem(COLLAPSE_KEY, String(!prev));
      return !prev;
    });
  }

  return (
    <aside
      className={cn(
        'min-h-screen bg-white text-slate-700 flex flex-col border-r border-slate-200 transition-all duration-200',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      <div className={cn('px-6 py-5 border-b border-slate-100 flex items-center', collapsed ? 'justify-center px-0' : 'justify-between')}>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#3b5bdb] flex-shrink-0" />
          {!collapsed && <span className="font-semibold text-[#1e3a5f] text-lg">FinOps</span>}
        </div>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Collapse sidebar"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggleCollapsed}
          className="mx-auto mt-3 p-1.5 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-600 cursor-pointer"
          title="Expand sidebar"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <NavLink
          href="/dashboard"
          label="Dashboard"
          icon={LayoutDashboard}
          collapsed={collapsed}
          active={pathname.startsWith('/dashboard') || pathname === '/'}
        />

        {/* Sales (AR) */}
        <SectionLabel collapsed={collapsed}>Sales</SectionLabel>
        {salesItems.map(item => (
          <NavLink key={item.href} {...item} collapsed={collapsed} active={pathname.startsWith(item.href)} />
        ))}

        {/* Procurement (AP) — every step is navigable; locked steps just
            carry a badge and read "view only" until their prerequisite
            is met. Nothing here is unclickable. */}
        <SectionLabel collapsed={collapsed}>Procurement</SectionLabel>
        {STEP_ORDER.map(step => (
          <NavLink
            key={step.key}
            href={stepHrefs[step.key]}
            label={step.label}
            icon={stepIcons[step.key]}
            collapsed={collapsed}
            active={pathname.startsWith(stepHrefs[step.key])}
            locked={!status[step.key]}
          />
        ))}

        {/* Reactive to a mismatch, not a sequential stage — always open */}
        <NavLink
          href="/disputes"
          label="Disputes"
          icon={AlertTriangle}
          collapsed={collapsed}
          active={pathname.startsWith('/disputes')}
        />

        <SectionLabel collapsed={collapsed}>General</SectionLabel>
        <NavLink href="/settings" label="Settings" icon={Settings} collapsed={collapsed} active={pathname.startsWith('/settings')} />
      </nav>

      <div className={cn('px-6 py-4 border-t border-slate-100', collapsed && 'px-0 flex justify-center')}>
        {!collapsed && <p className="text-xs text-slate-400">FinOps Platform v1.0</p>}
      </div>
    </aside>
  );
}