'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { grnService } from '@/services/ap';
import type { GRN } from '@/types/ap';
import { Loader2, Truck, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../../../../libs/shared/utils/date.utils';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-green-100 text-green-700',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
};


const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export default function GRNListPage() {
  const router = useRouter();
  const [grns, setGrns] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [status, setStatus] = useState('');

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await grnService.getAll({ status, page, limit: pagination.limit });
      setGrns(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load GRNs');
    } finally {
      setLoading(false);
    }
  }, [status, pagination.limit]);

  useEffect(() => { fetch(1); }, [status]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Goods Receipt Notes</h1>
        <p className="text-sm text-slate-500 mt-1">{pagination.total} total · Record deliveries from the Purchase Order page</p>
      </div>

      <div className="flex gap-3 mb-6">
        <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
        </select>
        {status && (
          <button onClick={() => setStatus('')} className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      ) : grns.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Truck size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No GRNs yet.</p>
          <p className="text-sm mt-1">Go to an issued Purchase Order and click "Record Delivery".</p>
          <button onClick={() => router.push('/purchase-orders')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
            View Purchase Orders
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['GRN #', 'PO #', 'Received By', 'Received At', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grns.map(grn => (
                <tr key={grn.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/grn/${grn.id}`)}>
                  <td className="px-4 py-3 font-mono text-blue-600 font-medium">{grn.grn_number}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{grn.po?.po_number ?? grn.po_id}</td>
                  <td className="px-4 py-3 text-slate-500">{grn.received_by ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{grn.received_at ? formatDate(grn.received_at) : '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[grn.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[grn.status] ?? grn.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.pages}</p>
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