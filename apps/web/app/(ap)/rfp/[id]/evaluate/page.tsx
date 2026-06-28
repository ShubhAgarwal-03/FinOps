'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { rfpService, vendorsService } from '@/services/ap';
import type { RFP, Vendor } from '@/types/ap';
import { formatCurrency } from '../../../../../../../libs/shared/utils/currency.utils';

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';

export default function RFPEvaluatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [scores, setScores] = useState<Record<string, { score: string; notes: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      rfpService.getOne(id),
      vendorsService.getAll({ limit: 200 }).then(r => r.data),
    ]).then(([r, v]) => {
      setRfp(r);
      setVendors(v);
      const init: Record<string, { score: string; notes: string }> = {};
      (r.vendor_quotes ?? []).forEach((q: { id: string }) => { init[q.id] = { score: '', notes: '' }; });
      setScores(init);
    })
      .catch(() => toast.error('Failed to load RFP'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSelect() {
    if (!selectedQuoteId) { toast.error('Select a winning quote first'); return; }
    setSubmitting(true);
    try {
      await rfpService.evaluate(id, {
        selected_quote_id: selectedQuoteId,
        evaluations: Object.entries(scores).map(([qid, s]) => ({
          vendor_quote_id: qid,
          score: s.score ? parseFloat(s.score) : undefined,
          notes: s.notes || undefined,
        })),
      });
      toast.success('Vendor selected. You can now create a Purchase Order.');
      router.push(`/rfp/${id}`);
    } catch {
      toast.error('Failed to select vendor');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!rfp) return <div className="p-6 text-slate-500">RFP not found.</div>;

  const quotes = rfp.vendor_quotes ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Evaluate Quotes</h1>
        <p className="text-sm text-slate-500 mt-1">{rfp.rfp_number} — {rfp.title}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Quote Comparison</h2>
          <p className="text-xs text-slate-500 mt-0.5">Score each vendor (optional) and select the winning quote.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Select</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead Time</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score (0–10)</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map(q => {
              const vendor = vendors.find(v => v.id === q.vendor_id);
              const isSelected = selectedQuoteId === q.id;
              return (
                <tr key={q.id} className={isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    <input
                      type="radio"
                      name="selected_quote"
                      value={q.id}
                      checked={isSelected}
                      onChange={() => setSelectedQuoteId(q.id)}
                      className="w-4 h-4 text-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{vendor?.vendor_name ?? q.vendor_id}</td>
                  <td className="px-4 py-3 font-mono text-slate-900">{formatCurrency(q.unit_price, 'INR', 'IN')}</td>
                  <td className="px-4 py-3 text-slate-500">{q.lead_time_days ? `${q.lead_time_days} days` : '—'}</td>
                  <td className="px-4 py-3 w-28">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={scores[q.id]?.score ?? ''}
                      onChange={e => setScores(p => ({ ...p, [q.id]: { ...p[q.id], score: e.target.value } }))}
                      className={inputClass}
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={scores[q.id]?.notes ?? ''}
                      onChange={e => setScores(p => ({ ...p, [q.id]: { ...p[q.id], notes: e.target.value } }))}
                      className={inputClass}
                      placeholder="Evaluation notes…"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedQuoteId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">
              {vendors.find(v => v.id === quotes.find(q => q.id === selectedQuoteId)?.vendor_id)?.vendor_name} selected as winning vendor
            </p>
          </div>
          <button
            onClick={handleSelect}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Selection
          </button>
        </div>
      )}

      <div className="flex justify-start">
        <button onClick={() => router.back()} className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
          Back to RFP
        </button>
      </div>
    </div>
  );
}