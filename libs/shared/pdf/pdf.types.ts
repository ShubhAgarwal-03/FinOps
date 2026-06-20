import type { CompanySnapshot } from '../utils/snapshot.utils';

// ─── Re-export for convenience ────────────────────────────────────────────────

export type { CompanySnapshot };

// ─── PDF line item ────────────────────────────────────────────────────────────

/**
 * Normalised line item shape consumed by pdf-line-items.ts.
 * Both SalesInvoice and VendorInvoice items map to this before rendering.
 */
export interface PDFLineItem {
  index: number;          // 1-based row number
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  /** Combined tax rate for display, e.g. 18 */
  tax_percent: number;
  line_total: number;
}

// ─── PDF tax summary row ──────────────────────────────────────────────────────

export interface PDFTaxRow {
  label: string;   // 'IGST 18%' | 'CGST 9%' | 'SGST 9%'
  amount: number;
}

// ─── PDF totals block ─────────────────────────────────────────────────────────

export interface PDFTotalsBlock {
  subtotal: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_total: number;
  grand_total: number;
  currency: string;
  country: string;
}

// ─── PDF document header ──────────────────────────────────────────────────────

export interface PDFDocumentHeader {
  /** 'INVOICE' | 'PURCHASE ORDER' | 'GOODS RECEIPT NOTE' | etc. */
  document_type: string;
  document_number: string;
  /** Workflow status for display badge */
  status?: string;
  issue_date: string;
  due_date?: string;
  currency: string;
}

// ─── Bill-to / vendor block ───────────────────────────────────────────────────

export interface PDFPartyBlock {
  label: 'BILL TO' | 'VENDOR' | 'SHIP TO' | 'DELIVER TO';
  name: string;
  address?: string;
  city?: string;
  state?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
}

// ─── Full PDF render context ──────────────────────────────────────────────────

export interface PDFRenderContext {
  company: CompanySnapshot;
  header: PDFDocumentHeader;
  party: PDFPartyBlock;
  secondary_party?: PDFPartyBlock;  // ship-to or deliver-to
  line_items: PDFLineItem[];
  tax_rows: PDFTaxRow[];
  totals: PDFTotalsBlock;
  notes?: string;
  terms?: string;
  reference_numbers?: { label: string; value: string }[];
}

// ─── PDFKit document type (lightweight, avoids importing pdfkit in types) ────

export interface PDFKitDoc {
  // Minimal surface used by shared pdf modules
  page: { height: number; width: number };
  fontSize(size: number): this;
  font(name: string): this;
  fillColor(color: string): this;
  strokeColor(color: string): this;
  lineWidth(w: number): this;
  text(text: string, x?: number, y?: number, opts?: Record<string, unknown>): this;
  rect(x: number, y: number, w: number, h: number): this;
  fill(color?: string): this;
  stroke(): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  end(): void;
}
