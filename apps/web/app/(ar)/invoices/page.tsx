'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { invoicesService } from '@/services/invoices';
import { Invoice, InvoiceStatus } from '@/types';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import {
  Loader2, FileText, Plus, MoreVertical,
  Search, X, ChevronLeft, ChevronRight
} from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-600',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [filters, setFilters]       = useState({ status: '', from: '', to: '', search: '' });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleteNumber, setDeleteNumber] = useState('');
  const [deleting, setDeleting]     = useState(false);

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await invoicesService.getAll({ ...filters, page, limit: pagination.limit });
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => { fetchInvoices(1); }, [filters]);

  useEffect(() => {
    function handleClick() { setActiveMenu(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function handleFilterChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function clearFilters() {
    setFilters({ status: '', from: '', to: '', search: '' });
  }

  const hasFilters = Object.values(filters).some(v => v !== '');

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    try {
      const updated = await invoicesService.updateStatus(id, status);
      // Prisma returns id not _id
      setInvoices(prev => prev.map(inv => inv.id === id ? updated : inv));
      toast.success(`Status updated to ${status.charAt(0).toUpperCase() + status.slice(1)}.`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setActiveMenu(null);
  }

  async function handleDuplicate(id: string) {
    try {
      const dup = await invoicesService.duplicate(id);
      toast.success(`Invoice duplicated as ${dup.invoice_number}.`);
      fetchInvoices(pagination.page);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setActiveMenu(null);
  }

  function confirmDelete(inv: Invoice) {
    setDeleteId(inv.id);          // was: inv._id
    setDeleteNumber(inv.invoice_number);
    setActiveMenu(null);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await invoicesService.delete(deleteId);
      setInvoices(prev => prev.filter(inv => inv.id !== deleteId)); // was: inv._id
      toast.success(`Invoice ${deleteNumber} deleted.`);
      setDeleteId(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const inputClass = "border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">{pagination.total} total</p>
        </div>
        <button
          onClick={() => router.push('/invoices/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="search" value={filters.search}
            onChange={handleFilterChange}
            placeholder="Search invoices..."
            className={`${inputClass} pl-9 w-56`} />
        </div>

        <select name="status" value={filters.status} onChange={handleFilterChange} className={inputClass}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
        </select>

        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-500">From</label>
          <input type="date" name="from" value={filters.from} onChange={handleFilterChange} className={inputClass} />
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-slate-500">To</label>
          <input type="date" name="to" value={filters.to} onChange={handleFilterChange} className={inputClass} />
        </div>

        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <FileText size={40} className="mx-auto mb-3 text-slate-300" />
          {hasFilters ? (
            <>
              <p className="font-medium">No invoices match your current filters.</p>
              <p className="text-sm mt-1">Try adjusting your search.</p>
              <button onClick={clearFilters}
                className="mt-4 text-sm text-blue-600 hover:underline">Clear filters</button>
            </>
          ) : (
            <>
              <p className="font-medium">No invoices yet.</p>
              <p className="text-sm mt-1">Click 'New Invoice' to create your first one.</p>
              <button onClick={() => router.push('/invoices/new')}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
                New Invoice
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Invoice #', 'Customer', 'Issue Date', 'Due Date', 'Total', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                      className="font-mono text-blue-600 hover:underline font-medium cursor-pointer">
                      {inv.invoice_number}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {inv.customer_snapshot.customer_name ?? inv.customer_snapshot.company_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.issue_date)}</td>
                  <td className="px-4 py-3 text-slate-500">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatCurrency(inv.total, inv.customer_snapshot.currency, inv.customer_snapshot.country)}
                  </td>
                  <td className="px-4 py-3">
                    {inv.payment_status === 'partial' ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE.partial}`}>
                        Partially Paid
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] ?? ''}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === inv.id ? null : inv.id); }}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
                      <MoreVertical size={16} />
                    </button>

                    {activeMenu === inv.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="absolute right-4 top-10 z-10 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                        <button
                          onClick={() => router.push(`/invoices/${inv.id}`)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          View
                        </button>
                        <button
                          onClick={() => router.push(`/invoices/${inv.id}/edit`)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          Edit
                        </button>
                        {inv.status !== 'sent' && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'sent')}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            Mark as Sent
                          </button>
                        )}
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'paid')}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            Mark as Paid
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(inv.id)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          Duplicate
                        </button>
                        <hr className="my-1 border-slate-100" />
                        <button
                          onClick={() => confirmDelete(inv)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.pages} — {pagination.total} invoices
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchInvoices(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => fetchInvoices(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete Invoice?</h2>
            <p className="text-sm text-slate-500 mb-6">
              Invoice {deleteNumber} will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}