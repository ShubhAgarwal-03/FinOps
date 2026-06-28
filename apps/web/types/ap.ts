// ─────────────────────────────────────────────────────────────────────────────
// AP (Accounts Payable) Types
// Mirrors Prisma schema — uses string id (not MongoDB _id)
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared ───────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' | 'other';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

// ── Vendor ───────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  vendor_code?: string;
  vendor_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  currency: string;
  gstin?: string;
  pan?: string;
  payment_terms?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorSnapshot {
  id: string;
  vendor_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  currency: string;
  gstin?: string;
  pan?: string;
}

// ── Requisition ──────────────────────────────────────────────────────────────

export type RequisitionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'converted_to_rfp';

export interface RequisitionItem {
  id: string;
  requisition_id: string;
  item_id?: string;
  description: string;
  quantity: number;
  unit_of_measure?: string;
  estimated_unit_price?: number;
  notes?: string;
  sort_order: number;
}

export interface Requisition {
  id: string;
  req_number: string;
  title: string;
  description?: string;
  status: RequisitionStatus;
  requested_by?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  required_by?: string;
  created_at: string;
  updated_at: string;
  items: RequisitionItem[];
}

// ── RFP ──────────────────────────────────────────────────────────────────────

export type RFPStatus = 'open' | 'evaluating' | 'vendor_selected' | 'closed';

export interface VendorQuote {
  id: string;
  rfp_id: string;
  vendor_id: string;
  vendor?: Vendor;
  unit_price: number;
  total_amount: number;
  lead_time_days?: number;
  validity_days?: number;
  notes?: string;
  submitted_at: string;
  evaluation?: QuoteEvaluation;
}

export interface QuoteEvaluation {
  id: string;
  rfp_id: string;
  vendor_quote_id: string;
  score?: number;
  price_score?: number;
  quality_score?: number;
  lead_time_score?: number;
  notes?: string;
  is_selected: boolean;
  selected_at?: string;
}

export interface RFP {
  id: string;
  rfp_number: string;
  requisition_id: string;
  title: string;
  description?: string;
  status: RFPStatus;
  deadline?: string;
  created_at: string;
  updated_at: string;
  vendor_quotes: VendorQuote[];
  quote_evaluations: QuoteEvaluation[];
}

// ── Purchase Order ────────────────────────────────────────────────────────────

export type POStatus =
  | 'draft'
  | 'issued'
  | 'cancelled';

export interface POItem {
  id: string;
  po_id: string;
  item_id?: string;
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  tax_lines: TaxLine[];
  line_total: number;
  sort_order: number;
}

export interface POAmendment {
  id: string;
  po_id: string;
  amendment_number: number;
  reason: string;
  changes: { field: string; old_value: unknown; new_value: unknown }[];
  amended_by?: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor?: Vendor;
  vendor_snapshot: VendorSnapshot;
  rfp_id?: string;
  status: POStatus;
  is_interstate: boolean;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_total: number;
  total: number;
  notes?: string;
  payment_terms?: string;
  delivery_address?: string;
  issued_at?: string;
  expected_delivery?: string;
  created_at: string;
  updated_at: string;
  items: POItem[];
  amendments: POAmendment[];
}

// ── GRN ──────────────────────────────────────────────────────────────────────

export type GRNStatus = 'draft' | 'confirmed';

export interface GRNItem {
  id: string;
  grn_id: string;
  po_item_id: string;
  po_item?: POItem;
  item_id?: string;
  description: string;
  quantity_received: number;
  notes?: string;
  sort_order: number;
}

export interface GRN {
  id: string;
  grn_number: string;
  po_id: string;
  po?: PurchaseOrder;
  status: GRNStatus;
  received_by?: string;
  received_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items: GRNItem[];
}

// ── Vendor Invoice ────────────────────────────────────────────────────────────

export type VendorInvoiceStatus =
  | 'draft'
  | 'submitted'
  | 'matched'
  | 'mismatched'
  | 'disputed'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'void';

export interface TaxLine {
  name: string;
  percent: number;
  tax_amount: number;
}

export interface VendorInvoiceItem {
  id: string;
  vendor_invoice_id: string;
  po_item_id: string;
  po_item?: POItem;
  item_id?: string;
  description: string;
  hsn_sac?: string;
  quantity_billed: number;
  unit_price: number;
  tax_lines: TaxLine[];
  line_total: number;
  sort_order: number;
}

export interface VendorInvoice {
  id: string;
  invoice_number: string;
  po_id: string;
  po?: PurchaseOrder;
  vendor_id: string;
  vendor?: Vendor;
  vendor_snapshot: VendorSnapshot;
  status: VendorInvoiceStatus;
  vendor_ref_number?: string;
  issue_date: string;
  due_date?: string;
  is_interstate: boolean;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_status: PaymentStatus;
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  items: VendorInvoiceItem[];
  match_results: MatchResult[];
  dispute_records: DisputeRecord[];
}

// ── Match ─────────────────────────────────────────────────────────────────────

export type MatchStatus = 'matched' | 'mismatched';

export interface MatchItemDetail {
  po_item_id: string;
  description: string;
  po_quantity: number;
  grn_quantity: number;
  invoice_quantity: number;
  is_matched: boolean;
  discrepancy_note: string | null;
}

export interface MatchResult {
  id: string;
  vendor_invoice_id: string;
  grn_id: string;
  status: MatchStatus;
  line_item_results: MatchItemDetail[];
  matched_at: string;
  created_at: string;
}

export interface MatchResultPayload {
  vendor_invoice_id: string;
  grn_id: string;
  status: MatchStatus;
  overall_matched: boolean;
  item_results: MatchItemDetail[];
  summary: string;
}

// ── Dispute ───────────────────────────────────────────────────────────────────

export type DisputeStatus =
  | 'open'
  | 'resolved_accept'
  | 'resolved_reject'
  | 'resolved_amend_po';

export type DisputeParty = 'vendor' | 'internal' | 'purchase_order';

export interface DisputeRecord {
  id: string;
  vendor_invoice_id: string;
  raised_by?: string;
  reason: string;
  responsible_party: DisputeParty;
  status: DisputeStatus;
  mismatch_detail: MatchItemDetail[];
  resolution?: string;
  resolution_action?: 'accept_invoice' | 'amend_po' | 'reject_invoice';
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Vendor Payment ────────────────────────────────────────────────────────────

export interface VendorPayment {
  id: string;
  payment_ref: string;
  vendor_invoice_id: string;
  vendor_id: string;
  vendor?: Vendor;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Vendor Ledger ─────────────────────────────────────────────────────────────

export type VendorLedgerEntryType = 'INVOICE_RECEIVED' | 'PAYMENT_MADE' | 'DEBIT_NOTE';

export interface VendorLedgerRow {
  id: string;
  vendor_id: string;
  vendor_invoice_id?: string;
  vendor_payment_id?: string;
  entry_type: VendorLedgerEntryType;
  direction: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string;
  reference_number?: string;
  entry_date: string;
  created_at: string;
}

export interface VendorLedgerResponse {
  vendor: Vendor;
  rows: VendorLedgerRow[];
  summary: {
    total_invoiced: number;
    total_paid: number;
    closing_balance: number;
    currency: string;
  };
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}