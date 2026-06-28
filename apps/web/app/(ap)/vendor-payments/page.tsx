'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { vendorPaymentsService } from '@/services/ap';
import type { VendorPayment } from '@/types/ap';
import { Loader2, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../../../../libs/shared/utils/date.utils';
import { formatCurrency } from '../../../../../libs/shared/utils/currency.utils';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', upi: 'UPI',
  cheque: 'Cheque', card: 'Card', other: 'Other',
};

export default function VendorPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await vendorPaymentsService.getAll({ page, limit: pagination.limit });
      setPayments(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load vendor payments');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => { fetch(1); }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Payments</h1>
          <p className="text-sm text-slate-500 mt-1">{pagination.total} total</p>
        </div>
        <button
          onClick={() => router.push('/vendor-payments/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer"
        >
          <CreditCard size={16} /> Record Payment
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <CreditCard size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No vendor payments yet.</p>
          <p className="text-sm mt-1">Payments can only be recorded against Finance-approved invoices.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Ref #', 'Vendor', 'Invoice', 'Amount', 'Method', 'Date', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.payment_ref}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <button
                      onClick={() => router.push(`/vendors/${p.vendor_id}`)}
                      className="hover:text-blue-600 hover:underline cursor-pointer"
                    >
                      {p.vendor?.vendor_name ?? p.vendor_id}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/vendor-invoices/${p.vendor_invoice_id}`)}
                      className="font-mono text-blue-600 hover:underline text-xs cursor-pointer"
                    >
                      {p.vendor_invoice_id.slice(0, 8)}…
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatCurrency(p.amount, p.vendor?.currency ?? 'INR', p.vendor?.country ?? 'IN')}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{METHOD_LABELS[p.method] ?? p.method}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.paid_at)}</td>
                  <td className="px-4 py-3 text-slate-400">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.pages} — {pagination.total} payments</p>
              <div className="flex gap-2">
                <button onClick={() => fetch(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"><ChevronLeft size={16} /></button>
                <button onClick={() => fetch(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}