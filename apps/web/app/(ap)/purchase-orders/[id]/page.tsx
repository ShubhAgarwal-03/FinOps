'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Lock, Send, AlertCircle, History, Truck } from 'lucide-react';
import { purchaseOrdersService } from '@/services/ap';
import type { PurchaseOrder } from '@/types/ap';
import ConfirmDialog from '../../../../components/shared/confirmDialog';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  cancelled: 'Cancelled',
};


export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [showIssueConfirm, setShowIssueConfirm] = useState(false);

  useEffect(() => {
    purchaseOrdersService.getOne(id)
      .then(setPo)
      .catch(() => toast.error('Failed to load purchase order'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleIssue() {
    setIssuing(true);
    try {
      const updated = await purchaseOrdersService.issue(id);
      setPo(updated);
      setShowIssueConfirm(false);
      toast.success('Purchase Order issued and locked.');
    } catch {
      toast.error('Failed to issue PO');
    } finally {
      setIssuing(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!po) return <div className="p-6 text-slate-500">Purchase Order not found.</div>;

  const isIssued = po.status === 'issued';
  const fmt = (n: number) => formatCurrency(n, po.vendor_snapshot?.currency ?? 'INR', po.vendor_snapshot?.country ?? 'IN');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{po.po_number}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[po.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[po.status] ?? po.status}</span>
            {isIssued && <Lock size={14} className="text-slate-400" />}
          </div>
          <p className="text-slate-600">{po.vendor_snapshot?.vendor_name}</p>
        </div>
        <div className="flex gap-2">
          {isIssued && (
            <>
              <button
                onClick={() => router.push(`/purchase-orders/${id}/amendments`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <History size={14} /> Amendments
              </button>
              <button
                onClick={() => router.push(`/purchase-orders/${id}/amend`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50 cursor-pointer"
              >
                <AlertCircle size={14} /> Raise Amendment
              </button>
              <button
                onClick={() => router.push(`/grn/new?po_id=${id}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 cursor-pointer"
              >
                <Truck size={14} /> Record Delivery
              </button>
            </>
          )}
          {po.status === 'draft' && (
            <button
              onClick={() => setShowIssueConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
            >
              <Send size={14} /> Issue PO
            </button>
          )}
        </div>
      </div>

      {isIssued && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <Lock size={14} className="text-amber-600" />
          <p className="text-sm text-amber-800">This Purchase Order is locked. To make corrections, raise a PO Amendment — do not attempt to edit directly.</p>
        </div>
      )}

      {/* Meta */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['Vendor', po.vendor_snapshot?.vendor_name ?? '—'],
            ['GSTIN', po.vendor_snapshot?.gstin ?? '—'],
            ['Payment Terms', po.payment_terms ?? '—'],
            ['Issued', po.issued_at ? formatDate(po.issued_at) : '—'],
            ['Expected Delivery', po.expected_delivery ? formatDate(po.expected_delivery) : '—'],
            ['Supply Type', po.is_interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-0.5">{label}</p>
              <p className="text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        {po.delivery_address && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Delivery Address</p>
            <p className="text-sm text-slate-700">{po.delivery_address}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Description', 'HSN/SAC', 'Qty', 'Unit Price', 'Line Total'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {po.items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-slate-700">{item.description}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{item.hsn_sac ?? '—'}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{item.quantity}</td>
                <td className="px-4 py-3 text-slate-900">{fmt(item.unit_price)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <div className="space-y-1 text-sm min-w-[220px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{fmt(po.subtotal)}</span>
            </div>
            {po.discount_amount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount ({po.discount_percent}%)</span>
                <span>−{fmt(po.discount_amount)}</span>
              </div>
            )}
            {po.tax_total > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Tax</span>
                <span>{fmt(po.tax_total)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1 mt-1 text-base">
              <span>Total</span>
              <span>{fmt(po.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showIssueConfirm}
        title="Issue Purchase Order?"
        message="Once issued, this PO will be locked and cannot be edited directly. Corrections must be made via PO Amendments."
        confirmLabel="Issue & Lock PO"
        confirmClass="bg-blue-600 hover:bg-blue-700 text-white"
        loading={issuing}
        onConfirm={handleIssue}
        onCancel={() => setShowIssueConfirm(false)}
      />
    </div>
  );
}