'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';
import { vendorPaymentsService } from '@/services/ap';
import { VendorPayment } from '@/types/ap';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';
import { getStepAccess } from '@/lib/workflow/stepAccess';
import StageLockBanner from '../../../components/shared/stageLockBanner';

// PLACE AT: apps/web/app/(ap)/vendor-payments/page.tsx
// New payments are created from an approved invoice's "Record Payment"
// button (routes to /vendor-payments/new?vendor_invoice_id=), which is why
// there's no "New" button here — this list is read-only history.

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

export default function VendorPaymentsPage() {
  const { status } = useWorkflowStatus();
  const access = getStepAccess(status, 'vendor_payments');
  const [items, setItems] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await vendorPaymentsService.getAll({ limit: 50 });
        setItems(res.data);
      } catch {
        toast.error('Failed to load payments');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPaid = items.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendor Payments</h1>
          <p className="text-sm text-slate-400 mt-1">{items.length} payment{items.length !== 1 ? 's' : ''} · {fmt(totalPaid)} total</p>
        </div>
      </div>

      {!access.unlocked && <StageLockBanner reason={access.reason} />}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Wallet className="w-8 h-8 mb-2" />
            <p className="text-sm">No payments recorded yet — record one from an approved invoice</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-700">{p.payment_ref}</td>
                  <td className="px-5 py-3 text-slate-600">{p.vendor?.vendor_name || p.vendor_id}</td>
                  <td className="px-5 py-3 text-slate-500 capitalize">{p.method.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(p.paid_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}