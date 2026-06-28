'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { vendorsService } from '@/services/ap';
import type { Vendor } from '@/types/ap';
import { Building2, Plus, Search, X, MoreVertical, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [search, setSearch] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchVendors = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await vendorsService.getAll({ search, page, limit: pagination.limit });
      setVendors(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [search, pagination.limit]);

  useEffect(() => { fetchVendors(1); }, [search]);

  useEffect(() => {
    function handleClick() { setActiveMenu(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await vendorsService.delete(deleteId);
      setVendors(prev => prev.filter(v => v.id !== deleteId));
      toast.success(`${deleteName} deleted.`);
      setDeleteId(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-slate-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Vendors</h1>
            <p className="text-slate-500 text-sm">{pagination.total} total</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/vendors/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
          <Plus className="w-4 h-4" /> New Vendor
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor name or company..."
              className={`${inputClass} pl-9 w-full`}
            />
          </div>
          {search && (
            <button onClick={() => setSearch('')}
              className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
              <X className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mb-4" />
          {search ? (
            <>
              <p className="text-slate-500 font-medium">No vendors match your search.</p>
              <button onClick={() => setSearch('')} className="text-blue-600 text-sm hover:underline mt-2 cursor-pointer">Clear search</button>
            </>
          ) : (
            <>
              <p className="text-slate-500 font-medium">No vendors yet.</p>
              <p className="text-slate-400 text-sm mb-4">Add your first vendor to get started.</p>
              <button onClick={() => router.push('/vendors/new')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
                New Vendor
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Vendor', 'Email', 'Phone', 'GSTIN', 'City', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/vendors/${v.id}`)}
                      className="font-medium text-blue-600 hover:underline cursor-pointer text-left">
                      {v.vendor_name}
                    </button>
                    {v.company_name && <p className="text-xs text-slate-400">{v.company_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{v.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{v.phone ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">{v.gstin ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{v.city ?? '—'}</td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === v.id ? null : v.id); }}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {activeMenu === v.id && (
                      <div className="absolute right-4 top-10 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-44 py-1"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => router.push(`/vendors/${v.id}`)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">View</button>
                        <button onClick={() => router.push(`/vendors/${v.id}/edit`)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">Edit</button>
                        <button onClick={() => router.push(`/vendors/${v.id}/ledger`)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">View Ledger</button>
                        <div className="border-t border-slate-100 my-1" />
                        <button onClick={() => { setDeleteId(v.id); setDeleteName(v.vendor_name); setActiveMenu(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.pages} — {pagination.total} vendors</p>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchVendors(pagination.page - 1)} disabled={pagination.page <= 1}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => fetchVendors(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-2">Delete Vendor?</h2>
            <p className="text-slate-500 text-sm mb-6">
              <span className="font-medium">{deleteName}</span> will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}