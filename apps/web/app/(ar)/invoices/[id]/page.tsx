'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { invoiceServices, Invoice, InvoiceStatus } from '@/services/ar';
import { companyService } from '../../../../lib/api/ar/index';
import { CompanyConfig } from '@/types/ar';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';
import { Loader2, Download, Copy, Trash2, ArrowLeft, CreditCard, ArrowRight } from 'lucide-react';

// PLACE AT: apps/web/app/(ar)/invoices/[id]/page.tsx
// Ported from the original Invoice-Generator's invoice detail page — same
// company header / bill-to / line-item table / totals / amount-in-words /
// bank-details layout — re-wired to services/ar.ts (the same invoiceServices
// the list page already uses) and lib/api/ar's companyService. Payments live
// on their own route (/invoices/[id]/payments) — this page just shows a
// compact summary card that links there.

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-slate-200 text-slate-500 line-through',
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
};

function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function convertHundreds(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + convertHundreds(n % 100);
  }
  if (amount === 0) return 'Zero';
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  let result = '';
  if (intPart >= 10000000) result += convertHundreds(Math.floor(intPart / 10000000)) + 'Crore ';
  if (intPart >= 100000) result += convertHundreds(Math.floor((intPart % 10000000) / 100000)) + 'Lakh ';
  if (intPart >= 1000) result += convertHundreds(Math.floor((intPart % 100000) / 1000)) + 'Thousand ';
  result += convertHundreds(intPart % 1000);
  if (decPart > 0) result += 'and ' + convertHundreds(decPart) + 'Paise';
  return result.trim() + ' Only';
}

function getTaxBreakdown(items: Invoice['items']) {
  const breakdown: Record<string, { name: string; amount: number }> = {};
  items.forEach(item => {
    (item.tax_lines ?? []).forEach(t => {
      const key = `${t.name}-${t.percent}`;
      if (!breakdown[key]) breakdown[key] = { name: `${t.name} (${t.percent}%)`, amount: 0 };
      breakdown[key].amount += t.tax_amount;
    });
  });
  return Object.values(breakdown);
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    Promise.all([invoiceServices.getOne(id), companyService.get()])
      .then(([inv, co]) => { setInvoice(inv); setCompany(co); })
      .catch(() => toast.error('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(status: InvoiceStatus) {
    if (!invoice) return;
    setUpdatingStatus(true);
    try {
      const updated = await invoiceServices.updateStatus(id, status);
      setInvoice(updated);
      toast.success(`Status updated to ${status.charAt(0).toUpperCase() + status.slice(1)}.`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const dup = await invoiceServices.duplicate(id);
      toast.success(`Invoice duplicated as ${dup.invoice_number}.`);
      router.push(`/invoices/${dup.id}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await invoiceServices.delete(id);
      toast.success(`Invoice ${invoice?.invoice_number} deleted.`);
      router.push('/invoices');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    const toastId = toast.loading('Preparing your PDF… this may take a moment.');
    try {
      const blob = await invoiceServices.downloadPdf(id);
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${invoice?.invoice_number || 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
      toast.success('Download started!', { id: toastId });
    } catch {
      toast.error('Failed to generate PDF. Please check your connection.', { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  if (!invoice) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-500">Invoice not found.</p>
    </div>
  );

  const currency = invoice.customer_snapshot?.currency ?? 'INR';
  const country = invoice.customer_snapshot?.country ?? 'IN';
  const fmt = (n: number) => formatCurrency(n, currency, country);
  const taxBreakdown = getTaxBreakdown(invoice.items);
  const displayName = invoice.customer_snapshot?.customer_name ?? '';
  const paymentStatus = invoice.payment_status ?? 'unpaid';
  const amountPaid = invoice.amount_paid ?? 0;
  const balanceDue = invoice.balance_due ?? invoice.total;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">

      {/* Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => router.push('/invoices')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== 'sent' && invoice.status !== 'void' && (
            <button onClick={() => handleStatusChange('sent')} disabled={updatingStatus}
              className="px-3 py-1.5 text-sm border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50 cursor-pointer">
              Mark as Sent
            </button>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'void' && (
            <button onClick={() => handleStatusChange('paid')} disabled={updatingStatus}
              className="px-3 py-1.5 text-sm border border-green-200 text-green-600 rounded-md hover:bg-green-50 disabled:opacity-50 cursor-pointer">
              Mark as Paid
            </button>
          )}
          <button onClick={handleDuplicate} disabled={duplicating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Duplicate
          </button>
          <button onClick={handleDownloadPdf} disabled={downloadingPdf}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
          <button onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-red-200 text-red-500 rounded-md hover:bg-red-50 cursor-pointer">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
        <div className="h-2 bg-blue-600" />

        <div className="p-8 space-y-8">

          {/* Header: company + invoice meta */}
          <div className="flex justify-between items-start flex-wrap gap-6">
            <div>
              {company?.logo_url && (
                <img src={company.logo_url} alt="logo" className="h-12 mb-3 object-contain" />
              )}
              <h1 className="text-xl font-bold text-slate-800">{company?.name}</h1>
              {company?.address && <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{company.address}</p>}
              {company?.email && <p className="text-sm text-slate-500">{company.email}</p>}
              {company?.phone && <p className="text-sm text-slate-500">{company.phone}</p>}
              {company?.gstin && <p className="text-xs text-slate-400 mt-1">GSTIN: {company.gstin}</p>}
              {company?.pan && <p className="text-xs text-slate-400">PAN: {company.pan}</p>}
            </div>

            <div className="text-right space-y-1">
              <div className="flex items-center justify-end gap-2 mb-2 flex-wrap">
                {paymentStatus === 'partial' ? (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_STATUS_BADGE['partial']}`}>
                    Partially Paid
                  </span>
                ) : paymentStatus === 'paid' ? (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_STATUS_BADGE['paid']}`}>
                    Fully Paid
                  </span>
                ) : (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[invoice.status]}`}>
                    {invoice.status}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-800 font-mono">{invoice.invoice_number}</p>
              {invoice.po_so_number && (
                <p className="text-xs text-slate-400">PO/SO: {invoice.po_so_number}</p>
              )}
              <p className="text-sm text-slate-500">Issue Date: {formatDate(invoice.issue_date)}</p>
              {invoice.due_date && (
                <p className="text-sm text-slate-500">Due Date: {formatDate(invoice.due_date)}</p>
              )}
              {invoice.payment_terms && (
                <p className="text-xs text-slate-400">Terms: {invoice.payment_terms}</p>
              )}
            </div>
          </div>

          {/* Bill To / Ship To */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-100">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bill To</p>
              <p className="font-semibold text-slate-800">{displayName}</p>
              {invoice.customer_snapshot.company_name && invoice.customer_snapshot.company_name !== displayName && (
                <p className="text-sm text-slate-500">{invoice.customer_snapshot.company_name}</p>
              )}
              {invoice.customer_snapshot.billing_address_1 && (
                <p className="text-sm text-slate-500">{invoice.customer_snapshot.billing_address_1}</p>
              )}
              {invoice.customer_snapshot.billing_address_2 && (
                <p className="text-sm text-slate-500">{invoice.customer_snapshot.billing_address_2}</p>
              )}
              {(invoice.customer_snapshot.city || invoice.customer_snapshot.state) && (
                <p className="text-sm text-slate-500">
                  {[invoice.customer_snapshot.city, invoice.customer_snapshot.state, invoice.customer_snapshot.postal_code].filter(Boolean).join(', ')}
                </p>
              )}
              {invoice.customer_snapshot.phone && <p className="text-sm text-slate-500">{invoice.customer_snapshot.phone}</p>}
              {invoice.customer_snapshot.email && <p className="text-sm text-slate-500">{invoice.customer_snapshot.email}</p>}
              {invoice.customer_snapshot.gstin && (
                <p className="text-xs text-slate-400 mt-1">GSTIN: {invoice.customer_snapshot.gstin}</p>
              )}
              {invoice.customer_snapshot.pan && (
                <p className="text-xs text-slate-400">PAN: {invoice.customer_snapshot.pan}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ship To</p>
              {invoice.shipping_address ? (
                <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.shipping_address}</p>
              ) : (
                <>
                  <p className="font-semibold text-slate-800">{displayName}</p>
                  <p className="text-sm text-slate-500">
                    {invoice.customer_snapshot.billing_address_1 || 'Same as billing address'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-blue-600 text-white">
                <tr>
                  {['#', 'Description', 'HSN/SAC', 'Qty', 'Unit Price', 'Tax', 'Amount'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => {
                  const taxDesc = (item.tax_lines ?? []).map(t => `${t.name} ${t.percent}%`).join(', ') || '—';
                  return (
                    <tr key={item.id ?? i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-pre-line">{item.description}</td>
                      <td className="px-4 py-3 text-slate-500">{item.hsn_sac || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{taxDesc}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{fmt(item.line_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Items</span>
                <span>{fmt(invoice.items.reduce((s, l) => s + l.quantity * l.unit_price, 0))}</span>
              </div>
              {taxBreakdown.map((t, i) => (
                <div key={i} className="flex justify-between text-sm text-slate-600">
                  <span>{t.name}</span>
                  <span>{fmt(t.amount)}</span>
                </div>
              ))}
              {invoice.discount_percent ? (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Discount ({invoice.discount_percent}%)</span>
                  <span>-{fmt(invoice.discount_amount ?? 0)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm font-semibold text-slate-700 pt-2 border-t border-slate-100">
                <span>Subtotal</span>
                <span>{fmt(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-slate-800 pt-2 border-t border-slate-200">
                <span>Total</span>
                <span>{fmt(invoice.total)}</span>
              </div>
              {amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600 pt-1">
                    <span>Amount Paid</span>
                    <span>-{fmt(amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t border-slate-200">
                    <span className={balanceDue === 0 ? 'text-slate-400' : 'text-red-600'}>Balance Due</span>
                    <span className={balanceDue === 0 ? 'text-slate-400' : 'text-red-600'}>{fmt(balanceDue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Amount in Words */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Amount in Words</p>
            <p className="text-sm text-slate-700 italic">{numberToWords(invoice.total)}</p>
          </div>

          {/* Bank Details */}
          {(company?.bank_name || company?.account_number) && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Bank Details</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
                {company.bank_name && <p>Bank: {company.bank_name}</p>}
                {company.account_number && <p>Account No: {company.account_number}</p>}
                {company.ifsc_code && <p>IFSC: {company.ifsc_code}</p>}
                {company.branch && <p>Branch: {company.branch}</p>}
              </div>
            </div>
          )}

          {/* Notes / Terms */}
          {(invoice.notes || invoice.terms_and_conditions) && (
            <div className="grid grid-cols-2 gap-8">
              {invoice.notes && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms_and_conditions && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Terms &amp; Conditions</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.terms_and_conditions}</p>
                </div>
              )}
            </div>
          )}

          {/* Authorized Signatory */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <div className="text-center">
              <div className="h-12 w-40 border-b border-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Authorized Signatory</p>
              <p className="text-xs text-slate-400 mt-0.5">{company?.name}</p>
            </div>
          </div>
        </div>

        <div className="h-2 bg-blue-600" />
      </div>

      {/* Payment summary — links out to the dedicated payments page */}
      <div className="max-w-4xl mx-auto mt-6">
        <button
          onClick={() => router.push(`/invoices/${id}/payments`)}
          className="w-full bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all p-5 flex items-center justify-between cursor-pointer text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-sm">Payments</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PAYMENT_STATUS_BADGE[paymentStatus]}`}>
                  {paymentStatus}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {fmt(amountPaid)} paid of {fmt(invoice.total)}
                {balanceDue > 0 && ` · ${fmt(balanceDue)} due`}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      {/* Delete Dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Invoice?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Invoice {invoice.invoice_number} will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}