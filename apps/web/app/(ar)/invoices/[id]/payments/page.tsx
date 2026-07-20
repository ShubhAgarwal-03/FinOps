'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { invoiceServices, Invoice } from '@/services/ar';
import { Loader2, ArrowLeft } from 'lucide-react';
import PaymentPanel from '../../../../../components/ar/paymentPanel';

// PLACE AT: apps/web/app/(ar)/invoices/[id]/payments/page.tsx
// Dedicated payments page, linked from the invoice detail page's payment
// summary card. Fetches the invoice via services/ar.ts (same as the detail
// page) and renders the shared PaymentPanel component.

export default function InvoicePaymentsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoiceServices.getOne(id)
      .then(setInvoice)
      .catch(() => toast.error('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto mb-6">
        <button
          onClick={() => router.push(`/invoices/${id}`)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Invoice
        </button>
      </div>

      <div className="max-w-3xl mx-auto mb-4">
        <h1 className="text-xl font-bold text-slate-800">
          Payments · <span className="font-mono">{invoice.invoice_number}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {invoice.customer_snapshot?.company_name || invoice.customer_snapshot?.customer_name}
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <PaymentPanel invoice={invoice} onInvoiceUpdate={setInvoice} />
      </div>
    </div>
  );
}