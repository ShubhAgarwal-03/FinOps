'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, ArrowRight } from 'lucide-react';
import { rfpService, vendorsService } from '@/services/ap';
import type { RFP, Vendor } from '@/types/ap';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';

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


const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

const emptyQuote = () => ({ vendor_id: '', unit_price: '', lead_time_days: '', validity_days: '', notes: '' });

export default function RFPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState(emptyQuote());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      rfpService.getOne(id),
      vendorsService.getAll({ limit: 200 }).then(r => r.data),
    ]).then(([r, v]) => { setRfp(r); setVendors(v); })
      .catch(() => toast.error('Failed to load RFP'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteForm.vendor_id || !quoteForm.unit_price) {
      toast.error('Vendor and unit price are required');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await rfpService.addQuote(id, {
        vendor_id: quoteForm.vendor_id,
        unit_price: parseFloat(quoteForm.unit_price),
        total_amount: parseFloat(quoteForm.unit_price),
        lead_time_days: quoteForm.lead_time_days ? parseInt(quoteForm.lead_time_days) : undefined,
        validity_days: quoteForm.validity_days ? parseInt(quoteForm.validity_days) : undefined,
        notes: quoteForm.notes || undefined,
      });
      setRfp(prev => prev ? { ...prev, vendor_quotes: [...(prev.vendor_quotes ?? []), updated] } : prev);
      setQuoteForm(emptyQuote());
      setShowQuoteForm(false);
      toast.success('Quote recorded.');
    } catch {
      toast.error('Failed to add quote');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!rfp) return <div className="p-6 text-slate-500">RFP not found.</div>;

  const quotes = rfp.vendor_quotes ?? [];
  const canEvaluate = quotes.length >= 1 && rfp.status === 'open';
  const isLocked = rfp.status === 'vendor_selected' || rfp.status === 'closed';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{rfp.rfp_number}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[rfp.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[rfp.status] ?? rfp.status}</span>
          </div>
          <p className="text-slate-600">{rfp.title}</p>
        </div>
        {canEvaluate && (
          <button
            onClick={() => router.push(`/rfp/${id}/evaluate`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
          >
            Evaluate & Select Vendor <ArrowRight size={14} />
          </button>
        )}
        {rfp.status === 'vendor_selected' && (
          <button
            onClick={() => router.push(`/purchase-orders/new?rfp_id=${id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
          >
            Create Purchase Order <ArrowRight size={14} />
          </button>
      )}
      </div>

      {/* Meta */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            ['Deadline', rfp.deadline ? formatDate(rfp.deadline) : '—'],
            ['Created', formatDate(rfp.created_at)],
            ['Quotes Received', String(quotes.length)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-0.5">{label}</p>
              <p className="text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        {rfp.description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-1">Description</p>
            <p className="text-sm text-slate-700">{rfp.description}</p>
          </div>
        )}
      </div>

      {/* Vendor Quotes */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Vendor Quotes</h2>
          {!isLocked && (
            <button
              onClick={() => setShowQuoteForm(v => !v)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
            >
              <Plus size={14} /> Add Quote
            </button>
          )}
        </div>

        {showQuoteForm && (
          <form onSubmit={handleAddQuote} className="px-5 py-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">New Quote</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Vendor *</label>
                <select value={quoteForm.vendor_id} onChange={e => setQuoteForm(p => ({ ...p, vendor_id: e.target.value }))} className={inputClass}>
                  <option value="">Select vendor…</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Unit Price *</label>
                <input type="number" min="0" step="0.01" value={quoteForm.unit_price} onChange={e => setQuoteForm(p => ({ ...p, unit_price: e.target.value }))} className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass}>Lead Time (days)</label>
                <input type="number" min="0" value={quoteForm.lead_time_days} onChange={e => setQuoteForm(p => ({ ...p, lead_time_days: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Validity (days)</label>
                <input type="number" min="0" value={quoteForm.validity_days} onChange={e => setQuoteForm(p => ({ ...p, validity_days: e.target.value }))} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Notes</label>
                <input value={quoteForm.notes} onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} placeholder="Any terms or conditions…" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowQuoteForm(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
                {submitting && <Loader2 size={13} className="animate-spin" />}
                Save Quote
              </button>
            </div>
          </form>
        )}

        {quotes.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-sm">No quotes yet. Add vendor quotes above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Vendor', 'Unit Price', 'Lead Time', 'Validity', 'Selected', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map(q => {
                const vendor = vendors.find(v => v.id === q.vendor_id);
                const isSelected = rfp.quote_evaluations?.find(e => e.vendor_quote_id === q.id && e.is_selected);
                return (
                  <tr key={q.id} className={isSelected ? 'bg-green-50' : ''}>
                    <td className="px-4 py-3 text-slate-700 font-medium">{vendor?.vendor_name ?? q.vendor_id}</td>
                    <td className="px-4 py-3 text-slate-900 font-mono">{formatCurrency(q.unit_price, 'INR', 'IN')}</td>
                    <td className="px-4 py-3 text-slate-500">{q.lead_time_days ? `${q.lead_time_days}d` : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{q.validity_days ? `${q.validity_days}d` : '—'}</td>
                    <td className="px-4 py-3">{isSelected ? <span className="text-green-700 font-semibold text-xs">✓ Selected</span> : '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{q.notes ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}