'use client';

import { useEffect, useState } from 'react';
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

export default function VendorInvoicesPage() {
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
        const res = await vendorInvoicesService.getAll({ status: initialStatus || undefined, limit: 50 });
        setItems(res.data);
      } catch {
        toast.error('Failed to load vendor invoices');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialStatus]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Vendor Invoices</h1>
        <p className="text-sm text-slate-400 mt-1">{items.length} invoice{items.length !== 1 ? 's' : ''}</p>
      </div>

      {!access.unlocked && <StageLockBanner reason={access.reason} />}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ReceiptText className="w-8 h-8 mb-2" />
            <p className="text-sm">No vendor invoices yet — submit one from a confirmed GRN</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">PO</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(inv => (
                <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/vendor-invoices/${inv.id}`)}>
                  <td className="px-5 py-3 font-medium text-slate-700">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-slate-600">{inv.vendor?.vendor_name || inv.vendor_snapshot?.vendor_name}</td>
                  <td className="px-5 py-3 text-slate-500">{inv.po?.po_number || inv.po_id}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{fmt(inv.total)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status]}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}