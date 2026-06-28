'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, History, Plus } from 'lucide-react';
import { purchaseOrdersService } from '@/services/ap';
import type { POAmendment } from '@/types/ap';
import { formatDate } from '../../../../../../../libs/shared/utils/date.utils';

export default function POAmendmentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [amendments, setAmendments] = useState<POAmendment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purchaseOrdersService.getAmendments(id)
      .then(setAmendments)
      .catch(() => toast.error('Failed to load amendments'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Amendment History</h1>
          <p className="text-sm text-slate-500 mt-1">{amendments.length} amendment{amendments.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/purchase-orders/${id}`)} className="px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            Back to PO
          </button>
          <button onClick={() => router.push(`/purchase-orders/${id}/amend`)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 cursor-pointer">
            <Plus size={14} /> New Amendment
          </button>
        </div>
      </div>

      {amendments.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <History size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No amendments yet.</p>
          <p className="text-sm mt-1">Amendments are raised when corrections are needed on an issued PO.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {amendments.map(a => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Amendment #{a.amendment_number}</span>
                <span className="text-xs text-slate-400">{formatDate(a.created_at)}</span>
              </div>
              <p className="text-sm text-slate-900 mb-3">{a.reason}</p>
              <div className="space-y-2">
                {a.changes.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs bg-slate-50 rounded px-3 py-2">
                    <span className="font-mono font-semibold text-slate-600">{c.field}</span>
                    <span className="text-slate-400">changed from</span>
                    <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{String(c.old_value ?? '—')}</span>
                    <span className="text-slate-400">to</span>
                    <span className="font-mono text-green-700 bg-green-50 px-1.5 py-0.5 rounded">{String(c.new_value)}</span>
                  </div>
                ))}
              </div>
              {a.amended_by && <p className="text-xs text-slate-400 mt-2">By: {a.amended_by}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}