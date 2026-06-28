'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { rfpService } from '@/services/ap';
import type { RFP } from '@/types/ap';
import { Loader2, Megaphone, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDate } from '../../../../../libs/shared/utils/date.utils';

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  evaluating: 'bg-purple-100 text-purple-700',
  vendor_selected: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-500',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  evaluating: 'Evaluating',
  vendor_selected: 'Vendor Selected',
  closed: 'Closed',
};


const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export default function RFPListPage() {
  const router = useRouter();
  const [rfps, setRfps] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [status, setStatus] = useState('');

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await rfpService.getAll({ status, page, limit: pagination.limit });
      setRfps(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load RFPs');
    } finally {
      setLoading(false);
    }
  }, [status, pagination.limit]);

  useEffect(() => { fetch(1); }, [status]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RFPs</h1>
          <p className="text-sm text-slate-500 mt-1">{pagination.total} total</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="evaluating">Evaluating</option>
          <option value="vendor_selected">Vendor Selected</option>
          <option value="closed">Closed</option>
        </select>
        {status && (
          <button onClick={() => setStatus('')} className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      ) : rfps.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Megaphone size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No RFPs yet.</p>
          <p className="text-sm mt-1">Approve a requisition and create an RFP from it.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['RFP #', 'Title', 'Deadline', 'Quotes', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rfps.map(rfp => (
                <tr key={rfp.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/rfp/${rfp.id}`)}>
                  <td className="px-4 py-3 font-mono text-blue-600 font-medium">{rfp.rfp_number}</td>
                  <td className="px-4 py-3 text-slate-700">{rfp.title}</td>
                  <td className="px-4 py-3 text-slate-500">{rfp.deadline ? formatDate(rfp.deadline) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{rfp.vendor_quotes?.length ?? 0}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[rfp.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[rfp.status] ?? rfp.status}</span></td>
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