'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { requisitionsService } from '@/services/ap';
import type { Requisition } from '@/types/ap';
import { Loader2, ClipboardList, Plus, Search, X, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../../../../libs/shared/utils/date.utils';
import ConfirmDialog from '../../../components/shared/confirmDialog';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  converted_to_rfp: 'bg-blue-100 text-blue-700',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  converted_to_rfp: 'Converted to RFP',
};


const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export default function RequisitionsPage() {
  const router = useRouter();
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReqs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await requisitionsService.getAll({ ...filters, page, limit: pagination.limit });
      setReqs(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => { fetchReqs(1); }, [filters]);

  useEffect(() => {
    function handleClick() { setActiveMenu(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const hasFilters = Object.values(filters).some(v => v !== '');

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await requisitionsService.delete(deleteId);
      setReqs(prev => prev.filter(r => r.id !== deleteId));
      toast.success('Requisition deleted.');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete requisition');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requisitions</h1>
          <p className="text-sm text-slate-500 mt-1">{pagination.total} total</p>
        </div>
        <button
          onClick={() => router.push('/requisitions/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer"
        >
          <Plus size={16} /> New Requisition
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
            placeholder="Search requisitions…"
            className={`${inputClass} pl-9 w-56`}
          />
        </div>
        <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className={inputClass}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="converted_to_rfp">Converted to RFP</option>
        </select>
        {hasFilters && (
          <button onClick={() => setFilters({ status: '', search: '' })} className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      ) : reqs.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <ClipboardList size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">{hasFilters ? 'No requisitions match your filters.' : 'No requisitions yet.'}</p>
          <p className="text-sm mt-1">{hasFilters ? 'Try adjusting your filters.' : 'Raise a requisition to start the procurement process.'}</p>
          {!hasFilters && (
            <button onClick={() => router.push('/requisitions/new')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
              New Requisition
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Req #', 'Title', 'Requested By', 'Required By', 'Items', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reqs.map(req => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/requisitions/${req.id}`)} className="font-mono text-blue-600 hover:underline font-medium cursor-pointer">
                      {req.req_number}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{req.title}</td>
                  <td className="px-4 py-3 text-slate-500">{req.requested_by ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{req.required_by ? formatDate(req.required_by) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{req.items.length}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[req.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[req.status] ?? req.status}</span></td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === req.id ? null : req.id); }}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {activeMenu === req.id && (
                      <div onClick={e => e.stopPropagation()} className="absolute right-4 top-10 z-10 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                        <button onClick={() => router.push(`/requisitions/${req.id}`)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">View</button>
                        {req.status === 'draft' && (
                          <button onClick={() => { setDeleteId(req.id); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">Delete</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.pages}</p>
              <div className="flex gap-2">
                <button onClick={() => fetchReqs(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"><ChevronLeft size={16} /></button>
                <button onClick={() => fetchReqs(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Requisition?"
        message="This draft requisition will be permanently deleted."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}