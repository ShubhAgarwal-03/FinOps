import type { TaxLine } from '../../types/money.types';

// ─── GST type enum ────────────────────────────────────────────────────────────

export type GSTType = 'IGST' | 'CGST_SGST';

// ─── GST determination input ──────────────────────────────────────────────────

/**
 * The two state values needed to decide IGST vs CGST+SGST.
 * Both values should be the full state name or a consistent state code.
 * e.g. 'Maharashtra', 'Karnataka', 'Delhi'
 *
 * Either party having a missing/empty state defaults to IGST (safest assumption
 * — interstate rates are never under-collected, only potentially over-collected).
 */
export interface GSTDeterminerInput {
  supplier_state: string | undefined | null;
  buyer_state: string | undefined | null;
}

// ─── GST calculation input ────────────────────────────────────────────────────

/**
 * Input for calculating GST on a single line item's base amount.
 */
export interface GSTCalcInput {
  /** Taxable base amount (after item-level discount if any) */
  taxable_amount: number;
  /** Combined GST rate, e.g. 18 for 18% GST */
  gst_rate_percent: number;
  gst_type: GSTType;
}

// ─── GST calculation result ───────────────────────────────────────────────────

/**
 * The TaxLine array produced by gst-calculator for a single line item.
 * Will have 1 entry (IGST) or 2 entries (CGST + SGST).
 */
export interface GSTCalcResult {
  tax_lines: TaxLine[];
  /** Sum of all tax_line.tax_amount values */
  total_tax: number;
}

// ─── Document-level GST summary input ────────────────────────────────────────

export interface GSTSummaryInput {
  is_interstate: boolean;
  /** All TaxLine entries from all line items in the document */
  all_tax_lines: TaxLine[];
}
