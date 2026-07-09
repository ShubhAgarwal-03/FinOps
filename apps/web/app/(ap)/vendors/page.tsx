'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Search, Loader2, Building2, Trash2 } from 'lucide-react';
import { vendorsService } from '@/services/ap';
import { Vendor } from '@/types/ap';
import ConfirmDialog from '../../../components/shared/confirmDialog' 

// PLACE AT: apps/web/app/(ap)/vendors/page.tsx

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  async function load() {
    setLoading(true);
    try {
      const res = await vendorsService.getAll({ search, page, limit });
      setVendors(res.data);
      setTotal(res.pagination.total);
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await vendorsService.delete(deleteTarget.id);
      toast.success('Vendor removed');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Failed to remove vendor');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
          <p className="text-sm text-slate-400 mt-1">{total} vendor{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => router.push('/vendors/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Vendor
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search vendors…"
          className="w-full max-w-sm pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Building2 className="w-8 h-8 mb-2" />
            <p className="text-sm">No vendors yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">City / State</th>
                <th className="px-5 py-3 font-medium">GSTIN</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr
                  key={v.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => router.push(`/vendors/${v.id}`)}
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-700">{v.vendor_name}</p>
                    {v.vendor_code && <p className="text-xs text-slate-400">{v.vendor_code}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{v.email || v.phone || '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{[v.city, v.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-5 py-3 text-slate-500">{v.gstin || '—'}</td>
                  <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setDeleteTarget(v)}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove vendor?"
        message={`This will remove ${deleteTarget?.vendor_name}. This can't be undone.`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}