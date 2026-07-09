'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { vendorInvoicesService, vendorPaymentsService } from '@/services/ap';
import { VendorInvoice, PaymentMethod } from '@/types/ap';

// PLACE AT: apps/web/app/(ap)/vendor-payments/new/page.tsx
// Gated: only reachable in a useful state when ?vendor_invoice_id= points
// at an invoice whose status is 'approved' — matched AND finance-approved.
// If it isn't, the form is withheld and a lock message explains why.

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

// Default export: wraps the form in Suspense, since useSearchParams()
// requires a Suspense boundary for static prerendering to succeed.
export default function NewVendorPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <NewVendorPaymentForm />
    </Suspense>
  );
}

function NewVendorPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('vendor_invoice_id') || '';

  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const inv = await vendorInvoicesService.getOne(invoiceId);
        setInvoice(inv);
        setAmount(String(inv.balance_due ?? inv.total));
      } catch {
        toast.error('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await vendorPaymentsService.create({
        vendor_invoice_id: invoice.id,
        amount: Number(amount),
        method,
        paid_at: paidAt,
        notes: notes || undefined,
      });
      toast.success('Payment recorded');
      router.push(`/vendor-invoices/${invoice.id}`);
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Gate: no invoice id, invoice not found, or invoice not yet approved
  if (!invoiceId || !invoice || invoice.status !== 'approved') {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <h1 className="text-lg font-semibold text-slate-800 mb-2">
          Payment not available yet
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {!invoiceId
            ? 'Open an approved vendor invoice and use "Record Payment" to get here.'
            : `This invoice is ${invoice?.status ?? 'not found'} — payment unlocks once it's matched and Finance-approved.`}
        </p>
        <button
          onClick={() => router.push('/vendor-invoices')}
          className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
        >
          Back to Vendor Invoices
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <button
        onClick={() => router.push(`/vendor-invoices/${invoice.id}`)}
        className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 cursor-pointer"
      >
        ← {invoice.invoice_number}
      </button>

      <h1 className="text-lg font-semibold text-slate-800 mb-1">Record Payment</h1>
      <p className="text-sm text-slate-500 mb-6">
        {invoice.vendor?.vendor_name} · Invoice total {fmt(invoice.total)}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Amount *
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Date
          </label>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/vendor-invoices/${invoice.id}`)}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Record Payment & Close
          </button>
        </div>
      </form>
    </div>
  );
}