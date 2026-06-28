'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Lock } from 'lucide-react';
import { grnService } from '@/services/ap';
import type { GRN } from '@/types/ap';
import ConfirmDialog from '../../../../components/shared/confirmDialog';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-green-100 text-green-700',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
};


export default function GRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [grn, setGrn] = useState<GRN | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    grnService.getOne(id)
      .then(setGrn)
      .catch(() => toast.error('Failed to load GRN'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const updated = await grnService.confirm(id);
      setGrn(updated);
      setShowConfirm(false);
      toast.success('GRN confirmed. You can now submit a vendor invoice.');
    } catch {
      toast.error('Failed to confirm GRN');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!grn) return <div className="p-6 text-slate-500">GRN not found.</div>;

  const isConfirmed = grn.status === 'confirmed';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{grn.grn_number}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[grn.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[grn.status] ?? grn.status}</span>
            {isConfirmed && <Lock size={13} className="text-slate-400" />}
          </div>
          <p className="text-slate-500 text-sm">PO: <span className="font-mono">{grn.po?.po_number ?? grn.po_id}</span></p>
        </div>
        {!isConfirmed && (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 cursor-pointer"
          >
            <CheckCircle2 size={14} /> Confirm GRN
          </button>
        )}
      </div>

      {isConfirmed && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 size={14} className="text-green-600" />
          <p className="text-sm text-green-800">GRN confirmed and locked. Received quantities are final.</p>
        </div>
      )}

      {/* Meta */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            ['Received By', grn.received_by ?? '—'],
            ['Received At', grn.received_at ? formatDate(grn.received_at) : '—'],
            ['Created', formatDate(grn.created_at)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-0.5">{label}</p>
              <p className="text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        {grn.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Notes</p>
            <p className="text-sm text-slate-700">{grn.notes}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Items Received</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Description', 'Qty Received', 'Notes'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {grn.items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-slate-700">{item.description}</td>
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{item.quantity_received}</td>
                <td className="px-4 py-3 text-slate-400">{item.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isConfirmed && (
        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/vendor-invoices/new?grn_id=${grn.id}&po_id=${grn.po_id}`)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 cursor-pointer"
          >
            Submit Vendor Invoice →
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Confirm GRN?"
        message="This will lock the received quantities. You will not be able to edit them after confirmation."
        confirmLabel="Confirm Receipt"
        confirmClass="bg-green-600 hover:bg-green-700 text-white"
        loading={confirming}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}