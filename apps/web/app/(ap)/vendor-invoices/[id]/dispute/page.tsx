'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { vendorInvoicesService, disputesService } from '@/services/ap';
import type { VendorInvoice, DisputeRecord } from '@/types/ap';
import DisputePanel from '../../../../../components/ap/disputePanel';

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-orange-100 text-orange-700',
  resolved_accept: 'bg-green-100 text-green-700',
  resolved_reject: 'bg-red-100 text-red-600',
  resolved_amend_po: 'bg-blue-100 text-blue-700',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  resolved_accept: 'Resolved — Accepted',
  resolved_reject: 'Resolved — Rejected',
  resolved_amend_po: 'Resolved — PO Amended',
};


export default function VendorInvoiceDisputePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [dispute, setDispute] = useState<DisputeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vendorInvoicesService.getOne(id).then(inv => {
      setInvoice(inv);
      if (inv.dispute_records?.length) {
        setDispute(inv.dispute_records[inv.dispute_records.length - 1]);
      }
    })
      .catch(() => toast.error('Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!invoice) return <div className="p-6 text-slate-500">Invoice not found.</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/vendor-invoices/${id}`)}
          className="text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Dispute</h1>
            <span className="font-mono text-slate-500 text-sm">— {invoice.invoice_number}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[invoice.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[invoice.status] ?? invoice.status}</span>
          </div>
          <p className="text-sm text-slate-500">{invoice.vendor_snapshot?.vendor_name}</p>
        </div>
      </div>

      <DisputePanel
        vendorInvoiceId={id}
        dispute={dispute}
        onRaised={d => {
          setDispute(d);
          setInvoice(prev => prev ? { ...prev, status: 'disputed' } : prev);
          toast.success('Dispute raised. Resolve it to proceed.');
        }}
        onResolved={d => {
          setDispute(d);
          toast.success('Dispute resolved. Re-submit and re-run the match.');
        }}
      />

      {dispute?.status !== 'open' && dispute && (
        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/vendor-invoices/${id}`)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 cursor-pointer"
          >
            Back to Invoice → Re-run Match
          </button>
        </div>
      )}
    </div>
  );
}