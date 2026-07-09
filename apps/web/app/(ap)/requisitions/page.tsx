'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, ClipboardList } from 'lucide-react';
import { requisitionsService } from '@/services/ap';
import { Requisition, RequisitionStatus } from '@/types/ap';

// PLACE AT: apps/web/app/(ap)/requisitions/page.tsx

const STATUS_BADGE: Record<RequisitionStatus, string> = {
  draft: 'bg-slate-100 text-slate-500',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  converted_to_rfp: 'bg-blue-100 text-blue-700',
};

const TABS: { label: string; value: RequisitionStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Converted', value: 'converted_to_rfp' },
];

export default function RequisitionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Requisition[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<RequisitionStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await requisitionsService.getAll({ status: status === 'all' ? undefined : status, page, limit });
        setItems(res.data);
        setTotal(res.pagination.total);
      } catch {
        toast.error('Failed to load requisitions');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, page]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Requisitions</h1>
          <p className="text-sm text-slate-400 mt-1">{total} requisition{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => router.push('/requisitions/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Requisition
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setPage(1); setStatus(tab.value); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer ${
              status === tab.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ClipboardList className="w-8 h-8 mb-2" />
            <p className="text-sm">No requisitions here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Requested By</th>
                <th className="px-5 py-3 font-medium">Needed By</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/requisitions/${r.id}`)}>
                  <td className="px-5 py-3 font-medium text-slate-700">{r.req_number}</td>
                  <td className="px-5 py-3 text-slate-600">{r.title}</td>
                  <td className="px-5 py-3 text-slate-500">{r.requested_by || '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{r.required_by ? new Date(r.required_by).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Page {page} of {Math.ceil(total / limit)}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 cursor-pointer">Previous</button>
            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 cursor-pointer">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}