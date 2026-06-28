'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2, Play, CheckCircle2, XCircle, Clock,
  AlertTriangle, CreditCard
} from 'lucide-react';
import {
  vendorInvoicesService, matchService, disputesService, vendorPaymentsService
} from '@/services/ap';
import type { VendorInvoice, MatchResult, DisputeRecord, VendorPayment } from '@/types/ap';
import MatchResultCard from '../../../../../web/components/ap/matchResultCard';
import DisputePanel from '../../../../../web/components/ap/disputePanel';
import VendorPaymentGate from '../../../../../web/components/ap/vendorPaymentGate';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';

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


const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', upi: 'UPI',
  cheque: 'Cheque', card: 'Card', other: 'Other',
};

export default function VendorInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [dispute, setDispute] = useState<DisputeRecord | null>(null);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting]   = useState(false);
  const [matching, setMatching]       = useState(false);
  const [approving, setApproving]     = useState<'approve' | 'reject' | null>(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm]         = useState({
    amount: '', method: 'bank_transfer', paid_at: new Date().toISOString().split('T')[0], notes: '',
  });
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    vendorInvoicesService.getOne(id).then(inv => {
      setInvoice(inv);
      if (inv.match_results?.length) setMatchResult(inv.match_results[inv.match_results.length - 1]);
      if (inv.dispute_records?.length) setDispute(inv.dispute_records[inv.dispute_records.length - 1]);
    })
      .catch(() => toast.error('Failed to load invoice'))
      .finally(() => setLoading(false));

    vendorPaymentsService.getAll({ vendor_invoice_id: id }).then(r => setPayments(r.data)).catch(() => {});
  }, [id]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const updated = await vendorInvoicesService.submit(id);
      setInvoice(updated);
      toast.success('Invoice submitted.');
    } catch { toast.error('Failed to submit invoice'); }
    finally { setSubmitting(false); }
  }

  async function handleRunMatch() {
    setMatching(true);
    try {
      const result = await vendorInvoicesService.runMatch(id);
      setMatchResult(result.match_result ?? result);
      const updated = await vendorInvoicesService.getOne(id);
      setInvoice(updated);
      toast.success(`Match result: ${result.match_result?.status ?? result.status ?? 'done'}`);
    } catch { toast.error('Failed to run match'); }
    finally { setMatching(false); }
  }

  async function handleApprove() {
    setApproving('approve');
    try {
      const updated = await vendorInvoicesService.approve(id);
      setInvoice(updated);
      toast.success('Invoice approved. Payment can now be recorded.');
    } catch { toast.error('Failed to approve invoice'); }
    finally { setApproving(null); }
  }

  async function handleReject() {
    setApproving('reject');
    try {
      const updated = await vendorInvoicesService.cancel(id);
      setInvoice(updated);
      toast.success('Invoice rejected.');
    } catch { toast.error('Failed to reject invoice'); }
    finally { setApproving(null); }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > invoice.balance_due + 0.01) { toast.error(`Amount exceeds balance due (${fmt(invoice.balance_due)})`); return; }
    setPaying(true);
    try {
      const { payment, invoice: updated } = await vendorPaymentsService.create({
        vendor_invoice_id: id,
        amount,
        method: payForm.method as VendorPayment['method'],
        paid_at: payForm.paid_at || undefined,
        notes: payForm.notes || undefined,
      }) as { payment: VendorPayment; invoice: VendorInvoice };
      setPayments(prev => [payment, ...prev]);
      setInvoice(updated);
      setPayForm({ amount: '', method: 'bank_transfer', paid_at: new Date().toISOString().split('T')[0], notes: '' });
      setShowPayForm(false);
      toast.success(`Payment of ${fmt(amount)} recorded.`);
    } catch { toast.error('Failed to record payment'); }
    finally { setPaying(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!invoice) return <div className="p-6 text-slate-500">Invoice not found.</div>;

  const fmt = (n: number) => formatCurrency(n, invoice.vendor_snapshot?.currency ?? 'INR', invoice.vendor_snapshot?.country ?? 'IN');
  const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';

  const canSubmit  = invoice.status === 'draft';
  const canMatch   = invoice.status === 'submitted' || invoice.status === 'mismatched';
  const canDispute = invoice.status === 'mismatched' && !dispute;
  const canApprove = invoice.status === 'matched';
  const canPay     = invoice.status === 'approved' && invoice.payment_status !== 'paid';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{invoice.invoice_number}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[invoice.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[invoice.status] ?? invoice.status}</span>
            {invoice.payment_status && invoice.payment_status !== 'unpaid' && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[invoice.payment_status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[invoice.payment_status] ?? invoice.payment_status}</span>
            )}
          </div>
          <p className="text-slate-500 text-sm">{invoice.vendor_snapshot?.vendor_name} · PO: <span className="font-mono">{invoice.po?.po_number ?? invoice.po_id}</span></p>
        </div>
      </div>

      {/* ── Invoice Details ── */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['Vendor Ref', invoice.vendor_ref_number ?? '—'],
            ['Issue Date', formatDate(invoice.issue_date)],
            ['Due Date', invoice.due_date ? formatDate(invoice.due_date) : '—'],
            ['Supply Type', invoice.is_interstate ? 'Interstate (IGST)' : 'Intrastate'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-0.5">{label}</p>
              <p className="text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Line Items ── */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Description', 'Qty Billed', 'Unit Price', 'Line Total'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-slate-700">{item.description}</td>
                <td className="px-4 py-3 font-mono text-slate-900">{item.quantity_billed}</td>
                <td className="px-4 py-3 text-slate-900">{fmt(item.unit_price)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <div className="space-y-1 text-sm min-w-[200px]">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
            {invoice.discount_amount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>−{fmt(invoice.discount_amount)}</span></div>}
            {invoice.tax_total > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{fmt(invoice.tax_total)}</span></div>}
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1 text-base">
              <span>Total</span><span>{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Step 1: Submit ── */}
      {canSubmit && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="font-semibold text-slate-900 mb-2">Step 1 — Submit Invoice</h2>
          <p className="text-sm text-slate-500 mb-4">Submit this invoice to begin the 3-way matching process.</p>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Submit for Matching
          </button>
        </div>
      )}

      {/* ── Step 2: 3-Way Match ── */}
      {(invoice.status === 'submitted' || invoice.status === 'matched' || invoice.status === 'mismatched' || invoice.status === 'disputed' || invoice.status === 'approved' || invoice.status === 'paid') && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Step 2 — 3-Way Match</h2>
            {canMatch && (
              <button onClick={handleRunMatch} disabled={matching} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
                {matching ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run Match
              </button>
            )}
          </div>
          {!matchResult && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Clock size={14} />
              <span>Match not yet run. Click "Run Match" to compare PO, GRN, and Invoice quantities.</span>
            </div>
          )}
          {matchResult && <MatchResultCard result={matchResult} />}
        </div>
      )}

      {/* ── Step 3: Dispute (only if mismatch) ── */}
      {(invoice.status === 'mismatched' || invoice.status === 'disputed' || (dispute && dispute.status !== 'open')) && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Step 3 — Dispute Resolution</h2>
          <DisputePanel
            vendorInvoiceId={id}
            dispute={dispute}
            onRaised={d => {
              setDispute(d);
              setInvoice(prev => prev ? { ...prev, status: 'disputed' } : prev);
            }}
            onResolved={d => {
              setDispute(d);
            }}
          />
          {dispute?.status !== 'open' && dispute && (
            <p className="text-xs text-slate-500">After resolving, re-submit the corrected invoice and run the match again.</p>
          )}
        </div>
      )}

      {/* ── Step 4: Finance Approval ── */}
      {(invoice.status === 'matched' || invoice.status === 'approved' || invoice.status === 'paid' || invoice.status === 'void') && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Step 4 — Finance Approval</h2>
          {canApprove && (
            <div className="flex items-center gap-3">
              <button onClick={handleApprove} disabled={!!approving} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-60 cursor-pointer">
                {approving === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Approve
              </button>
              <button onClick={handleReject} disabled={!!approving} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm rounded-md hover:bg-red-50 disabled:opacity-60 cursor-pointer">
                {approving === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reject
              </button>
            </div>
          )}
          {invoice.status === 'approved' && (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 size={14} />
              Approved{invoice.approved_by ? ` by ${invoice.approved_by}` : ''}{invoice.approved_at ? ` on ${formatDate(invoice.approved_at)}` : ''}.
            </div>
          )}
          {invoice.status === 'void' && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <XCircle size={14} /> Invoice rejected and voided.
            </div>
          )}
          {invoice.status === 'paid' && (
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 size={14} /> Approved and fully paid.
            </div>
          )}
        </div>
      )}

      {/* ── Step 5: Payment ── */}
      {(invoice.status === 'approved' || invoice.status === 'paid') && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Step 5 — Payment</h2>

          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              ['Invoice Total', fmt(invoice.total)],
              ['Amount Paid', fmt(invoice.amount_paid ?? 0)],
              ['Balance Due', fmt(invoice.balance_due ?? invoice.total)],
            ].map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-0.5">{label}</p>
                <p className="font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <VendorPaymentGate invoice={invoice} onProceed={() => setShowPayForm(v => !v)} />

          {/* Record payment form */}
          {showPayForm && canPay && (
            <form onSubmit={handlePayment} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800">Record Payment</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Amount *</label>
                  <input type="number" min="0.01" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} className={inputClass} placeholder={`Max ${fmt(invoice.balance_due)}`} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Method</label>
                  <select value={payForm.method} onChange={e => setPayForm(p => ({ ...p, method: e.target.value }))} className={inputClass}>
                    {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Date</label>
                  <input type="date" value={payForm.paid_at} onChange={e => setPayForm(p => ({ ...p, paid_at: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Notes</label>
                  <input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} placeholder="Optional…" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowPayForm(false)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" disabled={paying} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-60 cursor-pointer">
                  {paying && <Loader2 size={13} className="animate-spin" />}
                  <CreditCard size={13} /> Save Payment
                </button>
              </div>
            </form>
          )}

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment History</p>
              </div>
              <div className="divide-y divide-slate-100">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{fmt(p.amount)}</span>
                      <span className="text-xs text-slate-400 ml-2">{METHOD_LABELS[p.method]}</span>
                      {p.notes && <span className="text-xs text-slate-400 ml-2">· {p.notes}</span>}
                    </div>
                    <span className="text-xs text-slate-400">{formatDate(p.paid_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}