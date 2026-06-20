// ─── Currency ────────────────────────────────────────────────────────────────

export type Currency = string; // ISO 4217 e.g. 'INR', 'USD'

// ─── Money ───────────────────────────────────────────────────────────────────

/**
 * Represents a monetary value with its currency.
 * All amounts are stored as plain numbers rounded to 2 decimal places.
 * Use round2() from utils/round.utils before storing any computed value.
 */
export interface Money {
  amount: number;
  currency: Currency;
}

// ─── Tax line (per line item) ─────────────────────────────────────────────────

/**
 * A single tax component applied to a line item.
 * In the existing system this maps to ILineItemTax / LineItemTax.
 *
 * Examples:
 *   { name: 'IGST', percent: 18, tax_amount: 180 }
 *   { name: 'CGST', percent: 9,  tax_amount: 90  }
 *   { name: 'SGST', percent: 9,  tax_amount: 90  }
 */
export interface TaxLine {
  /** Optional reference to a master tax record */
  tax_id?: string;
  /** Display name: 'IGST' | 'CGST' | 'SGST' | custom */
  name: string;
  /** Rate as a percentage, e.g. 18 (not 0.18) */
  percent: number;
  /** Computed tax amount for this line, rounded to 2dp */
  tax_amount: number;
}

// ─── Tax summary (document level) ────────────────────────────────────────────

/**
 * Aggregated tax breakdown for a whole document (invoice, PO, etc.).
 * Mirrors the tax breakdown block rendered in PDFs.
 */
export interface TaxSummary {
  /** true = IGST only; false = CGST + SGST split */
  is_interstate: boolean;
  igst_total: number;
  cgst_total: number;
  sgst_total: number;
  /** Always igst_total + cgst_total + sgst_total */
  grand_tax_total: number;
}

// ─── Document totals ──────────────────────────────────────────────────────────

/**
 * The computed financial totals for any document that has line items.
 * Shared by SalesInvoice, VendorInvoice, PurchaseOrder.
 */
export interface DocumentTotals {
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_total: number;
  /** subtotal - discount_amount + tax_total */
  grand_total: number;
}
