'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ReceiptText } from 'lucide-react';
import { vendorInvoicesService } from '@/services/ap';
import { VendorInvoice, VendorInvoiceStatus } from '@/types/ap';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';
import { getStepAccess } from '@/lib/workflow/stepAccess';
import StageLockBanner from '../../../components/shared/stageLockBanner';

// PLACE AT: apps/web/app/(ap)/vendor-invoices/page.tsx
// vendor-invoices/new/page.tsx already exists.

const STATUS_BADGE: Record<VendorInvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-500',
  submitted: 'bg-amber-100 text-amber-700',
  matched: 'bg-green-100 text-green-700',
  mismatched: 'bg-red-100 text-red-600',
  disputed: 'bg-red-100 text-red-600',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-600',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-slate-100 text-slate-400',
};

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

// Default export: wraps the list in Suspense, since useSearchParams()
// requires a Suspense boundary for static prerendering to succeed.
export default function VendorInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <VendorInvoicesList />
    </Suspense>
  );
}

function VendorInvoicesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useWorkflowStatus();
  const access = getStepAccess(status, 'vendor_invoices');

  const [items, setItems] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const initialStatus = searchParams.get('status') || '';

  useEffect(() => {
    (async () => {
      try {
        const res = await vendorInvoicesService.getAll({
          status: initialStatus || undefined,
          limit: 50,
        });
        setItems(res.data);
      } catch {
        toast.error('Failed to load vendor invoices');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialStatus]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Vendor Invoices</h1>
          <p className="text-sm text-slate-500">
            {items.length} invoice{items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {!access.unlocked && <StageLockBanner reason={access.reason} />}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-sm text-slate-400">
          <ReceiptText className="w-8 h-8 mb-3 text-slate-300" />
          No vendor invoices yet — submit one from a confirmed GRN
        </div>
      ) : (
        <div className="border border-slate-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Invoice</th>
                <th className="text-left px-4 py-2 font-medium">Vendor</th>
                <th className="text-left px-4 py-2 font-medium">PO</th>
                <th className="text-left px-4 py-2 font-medium">Total</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/vendor-invoices/${inv.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {inv.vendor?.vendor_name || inv.vendor_snapshot?.vendor_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {inv.po?.po_number || inv.po_id}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{fmt(inv.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}