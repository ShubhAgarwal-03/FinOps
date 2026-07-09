'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2, ClipboardList, FileSearch, ShoppingCart, PackageCheck,
  ReceiptText, Wallet, AlertTriangle, ArrowRight, Plus, Building2,
} from 'lucide-react';
import {
  vendorsService, requisitionsService, rfpService, purchaseOrdersService, grnService,
  vendorInvoicesService, vendorPaymentsService, disputesService,
} from '@/services/ap';

function fmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

interface StageCount { label: string; href: string; icon: React.ElementType; count: number }

interface DashboardState {
  pendingApprovals: number;
  openDisputes: number;
  outstandingPayable: number;
  poIssuedTotal: number;
  stages: StageCount[];
}

function KPICard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Best-effort count — a source that 404s (backend service not built yet)
// degrades to 0 rather than breaking the whole dashboard.
async function safeCount(fn: () => Promise<{ pagination: { total: number } }>): Promise<number> {
  try {
    return (await fn()).pagination.total;
  } catch {
    return 0;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [
          pendingApprovals, openDisputes,
          vendorsCount, requisitionsCount, rfpCount, poCount, grnCount, invoicesCount, paymentsCount,
          approvedInvoices,
        ] = await Promise.all([
          safeCount(() => requisitionsService.getAll({ status: 'pending_approval', limit: 1 })),
          safeCount(() => disputesService.getAll({ status: 'open', limit: 1 })),
          safeCount(() => vendorsService.getAll({ limit: 1 })),
          safeCount(() => requisitionsService.getAll({ limit: 1 })),
          safeCount(() => rfpService.getAll({ limit: 1 })),
          safeCount(() => purchaseOrdersService.getAll({ limit: 1 })),
          safeCount(() => grnService.getAll({ limit: 1 })),
          safeCount(() => vendorInvoicesService.getAll({ limit: 1 })),
          safeCount(() => vendorPaymentsService.getAll({ limit: 1 })),
          vendorInvoicesService.getAll({ status: 'approved', limit: 100 }).catch(() => ({ data: [] as any[] })),
        ]);

        const outstandingPayable = (approvedInvoices.data ?? []).reduce(
          (sum: number, inv: any) => sum + (inv.total ?? 0), 0
        );

        setData({
          pendingApprovals,
          openDisputes,
          outstandingPayable,
          poIssuedTotal: poCount,
          stages: [
            { label: 'Vendors', href: '/vendors', icon: Building2, count: vendorsCount },
            { label: 'Requisitions', href: '/requisitions', icon: ClipboardList, count: requisitionsCount },
            { label: 'RFPs', href: '/rfp', icon: FileSearch, count: rfpCount },
            { label: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart, count: poCount },
            { label: 'GRNs', href: '/grn', icon: PackageCheck, count: grnCount },
            { label: 'Vendor Invoices', href: '/vendor-invoices', icon: ReceiptText, count: invoicesCount },
            { label: 'Payments', href: '/vendor-payments', icon: Wallet, count: paymentsCount },
          ],
        });
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Procurement pipeline at a glance</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Pending Approvals"
            value={String(data.pendingApprovals)}
            sub="requisitions awaiting manager sign-off"
            icon={ClipboardList}
            color="bg-amber-100 text-amber-600"
          />
          <KPICard
            label="Open Disputes"
            value={String(data.openDisputes)}
            sub="invoices flagged as mismatched"
            icon={AlertTriangle}
            color="bg-red-100 text-red-600"
          />
          <KPICard
            label="Outstanding Payable"
            value={fmt(data.outstandingPayable)}
            sub="approved invoices awaiting payment"
            icon={Wallet}
            color="bg-blue-100 text-blue-600"
          />
          <KPICard
            label="Purchase Orders"
            value={String(data.poIssuedTotal)}
            sub="total issued to date"
            icon={ShoppingCart}
            color="bg-green-100 text-green-600"
          />
        </div>

        {/* Pipeline + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Workflow pipeline — 2/3 width */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Workflow Pipeline</h2>
            <p className="text-xs text-slate-400 mb-5">Records at each stage of the procurement cycle</p>
            <div className="space-y-1">
              {data.stages.map((stage, i) => (
                <button
                  key={stage.href}
                  onClick={() => router.push(stage.href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                  <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <stage.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 flex-1 text-left">
                    {stage.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">{stage.count}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick actions — 1/3 width */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Quick Actions</h2>
            <p className="text-xs text-slate-400 mb-5">Start the next step in the workflow</p>
            <div className="space-y-2">
              {[
                { label: 'New Requisition', href: '/requisitions/new' },
                { label: 'New Purchase Order', href: '/purchase-orders/new' },
                { label: 'New GRN', href: '/grn/new' },
                { label: 'New Vendor Invoice', href: '/vendor-invoices/new' },
              ].map(action => (
                <button
                  key={action.href}
                  onClick={() => router.push(action.href)}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  {action.label}
                </button>
              ))}
            </div>
            {data.openDisputes > 0 && (
              <button
                onClick={() => router.push('/vendor-invoices?status=disputed')}
                className="w-full mt-4 flex items-center gap-2 px-3 py-2 border border-red-200 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                {data.openDisputes} dispute{data.openDisputes !== 1 ? 's' : ''} need attention
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}