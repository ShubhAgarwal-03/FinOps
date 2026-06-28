import { cn } from '../../../../libs/shared/utils';

const BADGE_STYLES: Record<string, string> = {
  // Generic
  draft:              'bg-slate-100 text-slate-600',
  pending:            'bg-yellow-100 text-yellow-700',
  active:             'bg-green-100 text-green-700',
  cancelled:          'bg-red-100 text-red-700',

  // Requisition
  pending_approval:   'bg-yellow-100 text-yellow-700',
  approved:           'bg-green-100 text-green-700',
  rejected:           'bg-red-100 text-red-700',
  converted_to_rfp:   'bg-blue-100 text-blue-700',

  // RFP
  open:               'bg-blue-100 text-blue-700',
  evaluating:         'bg-purple-100 text-purple-700',
  vendor_selected:    'bg-green-100 text-green-700',
  closed:             'bg-slate-100 text-slate-600',

  // PO
  issued:             'bg-blue-100 text-blue-700',

  // GRN
  confirmed:          'bg-green-100 text-green-700',

  // Vendor Invoice
  submitted:          'bg-blue-100 text-blue-700',
  matched:            'bg-green-100 text-green-700',
  mismatched:         'bg-amber-100 text-amber-700',
  disputed:           'bg-orange-100 text-orange-700',
  void:               'bg-slate-100 text-slate-500',
  paid:               'bg-green-100 text-green-700',

  // Match
  'matched-result':   'bg-green-100 text-green-700',
  'mismatched-result':'bg-amber-100 text-amber-700',

  // Dispute
  resolved_accept:    'bg-green-100 text-green-700',
  resolved_reject:    'bg-red-100 text-red-700',
  resolved_amend_po:  'bg-blue-100 text-blue-700',

  // Payment
  unpaid:             'bg-red-100 text-red-700',
  partial:            'bg-amber-100 text-amber-700',
  overpaid:           'bg-purple-100 text-purple-700',

  // AR Invoice
  sent:               'bg-blue-100 text-blue-700',
};

const LABEL_OVERRIDES: Record<string, string> = {
  pending_approval:    'Pending Approval',
  converted_to_rfp:   'Converted to RFP',
  vendor_selected:     'Vendor Selected',
  resolved_accept:     'Resolved — Accepted',
  resolved_reject:     'Resolved — Rejected',
  resolved_amend_po:   'Resolved — PO Amended',
};

interface Props {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  const style = BADGE_STYLES[status] ?? 'bg-slate-100 text-slate-600';
  const label = LABEL_OVERRIDES[status]
    ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', style, className)}>
      {label}
    </span>
  );
}