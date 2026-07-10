// ─────────────────────────────────────────────────────────────────────────
// AR (Accounts Receivable) Types — ported from the REAL original
// apps/web/src/types/index.ts (Mongo-based Invoice-Generator), converted
// to Postgres/Prisma conventions: `_id` -> `id`, `createdAt` -> `created_at`,
// plus `updated_at` and `is_deleted` added per the soft-delete pattern
// project-summary.md describes. Every other field name is kept IDENTICAL
// to the real original — only the id/timestamp convention changed.
// ─────────────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' | 'other';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

// ── Catalogue Item (shared table — used by both AR invoices and AP POs) ──

export interface Item {
  id: string;
  name: string;
  description?: string;
  unit_price: number;
  tax_percent: number;
  unit_of_measure?: string;
  item_type?: 'simple' | 'compound';
  currency?: string;
  hsn_sac?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ── Customer ────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  customer_code?: string;
  customer_type: 'individual' | 'business';
  customer_name: string;
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
  registration_number?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerSnapshot {
  id: string;
  customer_code?: string;
  customer_type: 'individual' | 'business';
  customer_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  gstin?: string;
  pan?: string;
  registration_number?: string;
  country: string;
  currency: string;
}

// ── Invoice line items ──────────────────────────────────────────────────

export interface LineItemTax {
  tax_id?: string;
  name: string;
  percent: number;
  tax_amount: number;
}

export interface LineItem {
  // Present once persisted (sales_invoice_items is now a normalized table,
  // not an embedded Mongo subdocument array) — absent while building the
  // form client-side before submit.
  id?: string;
  sales_invoice_id?: string;
  item_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  taxes: LineItemTax[];
  line_total: number;
  hsn_sac?: string;
}

// ── Sales Invoice ───────────────────────────────────────────────────────

export interface SalesInvoice {
  id: string;
  invoice_number: string;
  po_so_number?: string;
  customer_id: string;
  customer?: Customer;
  customer_snapshot: CustomerSnapshot;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string;
  items: LineItem[];
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_total: number;
  total: number;
  amount_paid?: number;
  balance_due?: number;
  payment_status?: PaymentStatus;
  shipping_address?: string | null;
  is_interstate?: boolean;
  notes?: string;
  tax_exempt?: boolean;
  payment_terms?: string;
  terms_and_conditions?: string;
  auto_payment_reminder?: boolean;
  created_by?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ── Payment ─────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  notes?: string;
  created_at: string;
}

// ── Company Settings (singleton, shared reference table) ──────────────
// Field names kept EXACTLY as the original — note it's `name` not
// `business_name`, and `account_number`/`ifsc_code`/`branch`, not the
// `bank_`-prefixed names I used in the first draft of this file.

export interface CompanyConfig {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  logo_url?: string;
  gstin?: string;
  pan?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch?: string;
}

// ── Pagination / list response ─────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface InvoiceListResponse {
  invoices: SalesInvoice[];
  pagination: PaginationMeta;
}

// ── Ledger ──────────────────────────────────────────────────────────────
// Original shape is a single flattened, chronological row list (not split
// into separate debit/credit entry types the way I over-built it before).

export interface LedgerRow {
  date: string;
  description: string;
  invoice_number?: string;
  invoice_id?: string;
  type: 'invoice' | 'payment';
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerSummary {
  total_invoiced: number;
  total_paid: number;
  closing_balance: number;
  currency: string;
  country: string;
}

export interface LedgerResponse {
  customer: Customer;
  rows: LedgerRow[];
  summary: LedgerSummary;
}