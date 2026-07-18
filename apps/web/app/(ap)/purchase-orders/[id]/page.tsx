'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Lock, FileEdit, PackageCheck } from 'lucide-react';
import { purchaseOrdersService } from '@/services/ap';
import { PurchaseOrder, POStatus } from '@/types/ap';
import { isRecordLocked } from '@/lib/workflow/stepAccess';
import ConfirmDialog from '../../../../components/shared/confirmDialog';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';

const STATUS_BADGE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-500',
  issued: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
};

const EDITABLE_STATUSES: POStatus[] = ['draft'];

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);

  async function load() {
    try {
      setPo(await purchaseOrdersService.getOne(id));
    } catch {
      toast.error('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleIssue() {
    setBusy(true);
    try {
      setPo(await purchaseOrdersService.issue(id));
      toast.success('Purchase order issued and locked');
      setIssueOpen(false);
    } catch {
      toast.error('Failed to issue purchase order');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  if (!po) return null;

  const locked = isRecordLocked(po.status, EDITABLE_STATUSES);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <button onClick={() => router.push('/purchase-orders')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Purchase Orders
      </button>
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-slate-800">{po.po_number}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[po.status]}`}>{po.status}</span>
      </div>
      <p className="text-sm text-slate-500 mb-6">{po.vendor?.vendor_name || po.vendor_snapshot?.vendor_name}</p>

      {locked && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-500 text-sm rounded-lg px-4 py-3 mb-6">
          <Lock className="w-4 h-4 flex-shrink-0" />
          {po.status === 'issued'
            ? 'This PO is locked once issued. Corrections go through a PO Amendment, never a direct edit.'
            : 'This PO is cancelled and can no longer be changed.'}
        </div>
      )}

      {/* Order details meta — matches what was collected at creation */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Order Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Payment Terms</p>
            <p className="text-slate-900">{po.payment_terms || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Expected Delivery</p>
            <p className="text-slate-900">{po.expected_delivery ? formatDate(po.expected_delivery) : '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Delivery Address</p>
            <p className="text-slate-900">{po.delivery_address || '—'}</p>
          </div>
          {po.notes && (
            <div className="col-span-2">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Notes</p>
              <p className="text-slate-900">{po.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Unit Price</th>
              <th className="py-2 font-medium text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map(item => (
              <tr key={item.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2 text-slate-700">{item.description}</td>
                <td className="py-2 text-right text-slate-700">{item.quantity}</td>
                <td className="py-2 text-right text-slate-500">{fmt(item.unit_price)}</td>
                <td className="py-2 text-right text-slate-700">{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end">
          <dl className="text-sm space-y-1 w-52">
            <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd className="text-slate-700">{fmt(po.subtotal)}</dd></div>
            {po.discount_amount > 0 && (
              <div className="flex justify-between text-green-700">
                <dt>Discount ({po.discount_percent}%)</dt>
                <dd>−{fmt(po.discount_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between"><dt className="text-slate-400">Tax</dt><dd className="text-slate-700">{fmt(po.tax_total)}</dd></div>
            <div className="flex justify-between font-semibold pt-1 border-t border-slate-100"><dt className="text-slate-700">Total</dt><dd className="text-slate-800">{fmt(po.total)}</dd></div>
          </dl>
        </div>
      </div>

      {po.amendments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Amendment History</h2>
          <ul className="space-y-3">
            {po.amendments.map(a => (
              <li key={a.id} className="text-sm border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                <p className="font-medium text-slate-700">Amendment #{a.amendment_number} — {a.reason}</p>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(a.created_at).toLocaleString('en-IN')}{a.amended_by ? ` · ${a.amended_by}` : ''}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        {po.status === 'draft' && (
          <button onClick={() => setIssueOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer">
            Issue Purchase Order
          </button>
        )}
        {po.status === 'issued' && (
          <>
            <button onClick={() => router.push(`/purchase-orders/${po.id}/amend`)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 cursor-pointer">
              <FileEdit className="w-4 h-4" /> Raise PO Amendment
            </button>
            <button onClick={() => router.push(`/grn/new?po_id=${po.id}`)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 cursor-pointer">
              <PackageCheck className="w-4 h-4" /> Record GRN
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={issueOpen}
        title="Issue purchase order?"
        message="Once issued, this PO is locked. Corrections after this point can only be made through a PO Amendment."
        confirmLabel="Issue & Lock"
        confirmClass="bg-blue-600 hover:bg-blue-700 text-white"
        loading={busy}
        onConfirm={handleIssue}
        onCancel={() => setIssueOpen(false)}
      />
    </div>
  );
}