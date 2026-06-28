'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { vendorInvoicesService } from '@/services/ap';
import type { VendorInvoice } from '@/types/ap';
import { Loader2, Receipt, Plus, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../../../../libs/shared/utils/date.utils';
import { formatCurrency } from '../../../../../libs/shared/utils/currency.utils';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  matched: 'bg-green-100 text-green-700',
  mismatched: 'bg-red-100 text-red-700',
  disputed: 'bg-orange-100 text-orange-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  paid: 'bg-slate-100 text-slate-600',
  void: 'bg-slate-100 text-slate-400',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  matched: 'Matched',
  mismatched: 'Mismatched',
  disputed: 'Disputed',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  void: 'Void',
};


const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export default function VendorInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [filters, setFilters] = useState({ status: '', search: '' });

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await vendorInvoicesService.getAll({ ...filters, page, limit: pagination.limit });
      setInvoices(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load vendor invoices');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => { fetch(1); }, [filters]);

  const hasFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">{pagination.total} total</p>
        </div>
        <button
          onClick={() => router.push('/vendor-invoices/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer"
        >
          <Plus size={16} /> Submit Invoice
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
            placeholder="Search invoices…"
            className={`${inputClass} pl-9 w-56`}
          />
        </div>
        <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className={inputClass}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="matched">Matched</option>
          <option value="mismatched">Mismatched</option>
          <option value="disputed">Disputed</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
        {hasFilters && (
          <button onClick={() => setFilters({ status: '', search: '' })} className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Receipt size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">{hasFilters ? 'No invoices match your filters.' : 'No vendor invoices yet.'}</p>
          <p className="text-sm mt-1">Submit a vendor invoice against a confirmed GRN.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Invoice #', 'Vendor', 'PO #', 'Total', 'Issue Date', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => router.push(`/vendor-invoices/${inv.id}`)}>
                  <td className="px-4 py-3 font-mono text-blue-600 font-medium">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-slate-700">{inv.vendor_snapshot?.vendor_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{inv.po?.po_number ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(inv.total, inv.vendor_snapshot?.currency ?? 'INR', inv.vendor_snapshot?.country ?? 'IN')}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(inv.issue_date)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[inv.status] ?? inv.status}</span></td>
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