'use client';
import Link from 'next/link';
import { cn } from '../../../../libs/shared/utils';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  FileText, Users, Package, Settings, LayoutDashboard,
  ChevronDown, ChevronRight, Lock,
  Building2, ClipboardList, Megaphone, ShoppingCart,
  Truck, Receipt, CreditCard,
} from 'lucide-react';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';

const arItems = [
  { href: '/invoices',   label: 'Invoices',   icon: FileText },
  { href: '/customers',  label: 'Customers',  icon: Users },
];

const apItems = [
  { href: '/vendors',          label: 'Vendors',          icon: Building2,     key: 'vendors' },
  { href: '/requisitions',     label: 'Requisitions',     icon: ClipboardList, key: 'requisitions' },
  { href: '/rfp',              label: 'RFP',              icon: Megaphone,     key: 'rfp' },
  { href: '/purchase-orders',  label: 'Purchase Orders',  icon: ShoppingCart,  key: 'purchase_orders' },
  { href: '/grn',              label: 'GRN',              icon: Truck,         key: 'grn' },
  { href: '/vendor-invoices',  label: 'Vendor Invoices',  icon: Receipt,       key: 'vendor_invoices' },
  { href: '/vendor-payments',  label: 'Vendor Payments',  icon: CreditCard,    key: 'vendor_payments' },
] as const;

type APKey = typeof apItems[number]['key'];

export default function Sidebar() {
  const pathname = usePathname();
  const { status } = useWorkflowStatus();

  const [apOpen, setApOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('ap_sidebar_open');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ap_sidebar_open', String(apOpen));
  }, [apOpen]);

  // Auto-open AP section if user is on an AP page
  useEffect(() => {
    if ((pathname.startsWith('/vendors') || pathname.startsWith('/requisitions') || pathname.startsWith('/rfp') || pathname.startsWith('/purchase-orders') || pathname.startsWith('/grn') || pathname.startsWith('/vendor-invoices') || pathname.startsWith('/vendor-payments'))) setApOpen(true);
  }, [pathname]);

  const isUnlocked = (key: APKey) => status[key as keyof typeof status] ?? false;

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <span className="text-base font-bold text-slate-900 tracking-tight">FinOps</span>
        <span className="text-base font-light text-slate-400 tracking-tight"> Platform</span>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {/* Dashboard */}
        <div className="px-3 mb-1">
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === '/dashboard'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </Link>
        </div>

        {/* AR Section */}
        <div className="px-3 mt-4 mb-1">
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
            Accounts Receivable
          </p>
          {arItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>

        {/* AP Section */}
        <div className="px-3 mt-4">
          <button
            onClick={() => setApOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors rounded-md hover:bg-slate-50"
          >
            <span>Accounts Payable</span>
            {apOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {apOpen && (
            <div className="mt-1 space-y-0.5">
              {apItems.map(({ href, label, icon: Icon, key }) => {
                const unlocked = isUnlocked(key);
                const active = pathname.startsWith(href);

                if (!unlocked) {
                  return (
                    <div
                      key={href}
                      title={`Complete previous steps to unlock ${label}`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-slate-300 cursor-not-allowed select-none"
                    >
                      <Icon size={16} />
                      <span className="flex-1">{label}</span>
                      <Lock size={11} className="text-slate-300" />
                    </div>
                  );
                }

                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Catalogue & Settings */}
        <div className="px-3 mt-4">
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
            Catalogue
          </p>
          <Link
            href="/items"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith('/items')
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Package size={16} />
            Items
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname.startsWith('/settings')
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          <Settings size={16} />
          Settings
        </Link>
        <p className="text-[10px] text-slate-400 mt-3 px-3">FinOps Platform v2.0</p>
      </div>
    </aside>
  );
}