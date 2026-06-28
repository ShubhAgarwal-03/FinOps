'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Lock, CreditCard } from 'lucide-react';
import { vendorPaymentsService, vendorInvoicesService } from '@/services/ap';
import type { VendorInvoice } from '@/types/ap';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', upi: 'UPI',
  cheque: 'Cheque', card: 'Card', other: 'Other',
};

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

export default function NewVendorPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceIdParam = searchParams.get('invoice_id');

  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [selected, setSelected] = useState<VendorInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    amount: '',
    method: 'bank_transfer',
    paid_at: new Date().toISOString().split('T')[0],
    payment_ref: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    vendorInvoicesService.getAll({ status: 'approved', limit: 100 })
      .then(r => {
        // Only show invoices with remaining balance
        const payable = r.data.filter((inv: VendorInvoice) => inv.payment_status !== 'paid');
        setInvoices(payable);
        if (invoiceIdParam) {
          const match = payable.find((inv: VendorInvoice) => inv.id === invoiceIdParam);
          if (match) {
            setSelected(match);
            setForm(p => ({ ...p, amount: String(match.balance_due ?? match.total) }));
          }
        }
      })
      .catch(() => toast.error('Failed to load approved invoices'))
      .finally(() => setLoading(false));
  }, [invoiceIdParam]);

  function selectInvoice(inv: VendorInvoice) {
    setSelected(inv);
    setForm(p => ({ ...p, amount: String(inv.balance_due ?? inv.total) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) { toast.error('Select an invoice'); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const balance = selected.balance_due ?? selected.total;
    if (amount > balance + 0.01) {
      toast.error(`Amount exceeds balance due (${fmt(balance)})`);
      return;
    }
    setSaving(true);
    try {
      await vendorPaymentsService.create({
        vendor_invoice_id: selected.id,
        amount,
        method: form.method as 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' | 'other',
        paid_at: form.paid_at || undefined,
        payment_ref: form.payment_ref || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Payment recorded.');
      router.push('/vendor-payments');
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  const fmt = (n: number) => selected
    ? formatCurrency(n, selected.vendor_snapshot?.currency ?? 'INR', selected.vendor_snapshot?.country ?? 'IN')
    : `₹${n.toFixed(2)}`;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Record Vendor Payment</h1>
        <p className="text-sm text-slate-500 mt-1">Only Finance-approved invoices with outstanding balances appear here.</p>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-lg">
          <Lock size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-700">No payable invoices</p>
          <p className="text-sm text-slate-400 mt-1">
            Vendor invoices must be matched and Finance-approved before payment can be recorded.
          </p>
          <button
            onClick={() => router.push('/vendor-invoices')}
            className="mt-4 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            View Vendor Invoices →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Selection */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-700">Select Invoice</h2>
            {selected ? (
              <div className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <div>
                  <p className="font-mono font-semibold text-blue-700 text-sm">{selected.invoice_number}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selected.vendor_snapshot?.vendor_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Total {fmt(selected.total)} · Paid {fmt(selected.amount_paid ?? 0)} · Balance {fmt(selected.balance_due ?? selected.total)}
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-blue-500 hover:text-blue-700 underline cursor-pointer">Change</button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {invoices.map(inv => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => selectInvoice(inv)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-semibold text-blue-600 text-sm">{inv.invoice_number}</span>
                        <span className="text-slate-500 text-sm ml-2">— {inv.vendor_snapshot?.vendor_name}</span>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-slate-500">Due: <span className="font-semibold text-red-600">{formatCurrency(inv.balance_due ?? inv.total, inv.vendor_snapshot?.currency ?? 'INR', 'IN')}</span></p>
                        {inv.due_date && <p className="text-slate-400">{formatDate(inv.due_date)}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Payment form */}
          {selected && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-700">Payment Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Amount * (max {fmt(selected.balance_due ?? selected.total)})</label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Method</label>
                  <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))} className={inputClass}>
                    {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Payment Date</label>
                  <input type="date" value={form.paid_at} onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Payment Reference</label>
                  <input value={form.payment_ref} onChange={e => setForm(p => ({ ...p, payment_ref: e.target.value }))} className={inputClass} placeholder="UTR / cheque number…" />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} placeholder="Optional notes…" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
            {selected && (
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 disabled:opacity-60 cursor-pointer">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                Record Payment
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}