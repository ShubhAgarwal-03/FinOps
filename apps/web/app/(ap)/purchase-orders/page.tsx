'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShoppingCart } from 'lucide-react';
import { purchaseOrdersService } from '@/services/ap';
import { PurchaseOrder, POStatus } from '@/types/ap';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';
import { getStepAccess } from '@/lib/workflow/stepAccess';
import StageLockBanner from '../../../components/shared/stageLockBanner';

// PLACE AT: apps/web/app/(ap)/purchase-orders/page.tsx
// NOTE: POs are created from a vendor-selected RFP ("Create Purchase Order")
// — /purchase-orders/new already exists and accepts ?rfp_id=.

const STATUS_BADGE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-500',
  issued: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
};

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { status } = useWorkflowStatus();
  const access = getStepAccess(status, 'purchase_orders');
  const [items, setItems] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await purchaseOrdersService.getAll({ limit: 50 });
        setItems(res.data);
      } catch {
        toast.error('Failed to load purchase orders');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
        <p className="text-sm text-slate-400 mt-1">{items.length} purchase order{items.length !== 1 ? 's' : ''}</p>
      </div>

      {!access.unlocked && <StageLockBanner reason={access.reason} />}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ShoppingCart className="w-8 h-8 mb-2" />
            <p className="text-sm">No purchase orders yet — create one from a vendor-selected RFP</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">PO Number</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(po => (
                <tr key={po.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/purchase-orders/${po.id}`)}>
                  <td className="px-5 py-3 font-medium text-slate-700">{po.po_number}</td>
                  <td className="px-5 py-3 text-slate-600">{po.vendor?.vendor_name || po.vendor_snapshot?.vendor_name}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{fmt(po.total)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[po.status]}`}>{po.status}</span>
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