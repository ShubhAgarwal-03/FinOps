import { Lock, CheckCircle2 } from 'lucide-react';
import type { VendorInvoice } from '@/types/ap';

interface Props {
  invoice: VendorInvoice;
  onProceed: () => void;
}

type BlockReason = {
  label: string;
  detail: string;
};

function getBlockReason(invoice: VendorInvoice): BlockReason | null {
  if (invoice.status === 'mismatched' || invoice.status === 'disputed') {
    return {
      label: '3-Way match has not passed',
      detail: 'Resolve the mismatch or dispute before payment can proceed.',
    };
  }
  if (invoice.status === 'submitted' || invoice.status === 'draft') {
    return {
      label: '3-Way match not yet run',
      detail: 'Run the 3-way match and get Finance approval first.',
    };
  }
  if (invoice.status === 'matched') {
    return {
      label: 'Awaiting Finance approval',
      detail: 'Finance must approve this invoice before payment.',
    };
  }
  if (invoice.payment_status === 'paid') {
    return {
      label: 'Invoice fully paid',
      detail: 'No further payments required.',
    };
  }
  return null; // payment is allowed
}

export default function VendorPaymentGate({ invoice, onProceed }: Props) {
  const block = getBlockReason(invoice);

  if (block) {
    return (
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-lg px-5 py-4">
        <Lock size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-700">{block.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{block.detail}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-5 py-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-green-600" />
        <p className="text-sm font-semibold text-green-800">Invoice approved — payment authorised</p>
      </div>
      <button
        onClick={onProceed}
        className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 font-medium cursor-pointer"
      >
        Record Payment
      </button>
    </div>
  );
}