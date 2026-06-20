import { round2 } from '../../utils/round.utils';
import type { DocumentTotals, TaxLine } from '../../types/money.types';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface LineItemInput {
  quantity: number;
  unit_price: number;
  /** Pre-computed tax lines (from gst-calculator or passed in directly) */
  tax_lines: TaxLine[];
}

export interface TotalsInput {
  items: LineItemInput[];
  /** Document-level discount as a percentage, e.g. 10 for 10% */
  discount_percent?: number;
}

// ─── Per-item result ──────────────────────────────────────────────────────────

export interface LineItemTotals {
  base_amount: number;   // qty × unit_price, before tax
  tax_total: number;     // sum of all tax_lines[].tax_amount
  line_total: number;    // base_amount + tax_total
}

// ─── Full result ──────────────────────────────────────────────────────────────

export interface TotalsResult extends DocumentTotals {
  line_totals: LineItemTotals[];
}

// ─── Calculator ───────────────────────────────────────────────────────────────

/**
 * Computes subtotal, discount, tax, and grand total for any document
 * that has line items (SalesInvoice, VendorInvoice, PurchaseOrder).
 *
 * This replaces the inline `calculateTotals()` in route-invoice.ts.
 * The logic is identical but extracted so both AR and AP share it.
 *
 * Rounding strategy:
 *   - Each line_total is rounded to 2dp before accumulation
 *   - subtotal is the sum of (qty × price) rounded per item
 *   - tax_total is the sum of all tax_amount values (already rounded by gst-calculator)
 *   - discount_amount = round2(subtotal × discount_percent / 100)
 *   - grand_total = subtotal − discount_amount + tax_total
 *
 * Note: grand_total is computed from rounded intermediates, which matches
 * the existing invoice route behaviour exactly.
 */
export function calculateTotals(input: TotalsInput): TotalsResult {
  const { items, discount_percent = 0 } = input;

  let subtotal = 0;
  let tax_total = 0;

  const line_totals: LineItemTotals[] = items.map((item) => {
    const qty   = Number(item.quantity)   || 0;
    const price = Number(item.unit_price) || 0;
    const base  = round2(qty * price);

    const item_tax = round2(
      item.tax_lines.reduce((sum, tl) => sum + tl.tax_amount, 0),
    );
    const line_total = round2(base + item_tax);

    subtotal  = round2(subtotal  + base);
    tax_total = round2(tax_total + item_tax);

    return { base_amount: base, tax_total: item_tax, line_total };
  });

  const disc_pct    = Math.min(100, Math.max(0, Number(discount_percent) || 0));
  const discount_amount = round2(subtotal * (disc_pct / 100));
  const grand_total     = round2(subtotal - discount_amount + tax_total);

  return {
    line_totals,
    subtotal,
    discount_percent: disc_pct,
    discount_amount,
    tax_total,
    grand_total,
  };
}

// ─── Adapter for service layer ────────────────────────────────────────────────
/**
 * Convenience wrapper used by AR + AP services.
 * Accepts the raw item arrays from request bodies (where tax_lines only have
 * name + percent, not tax_amount yet) and computes tax_amount before passing
 * to calculateTotals.
 */
export interface ServiceLineItemInput {
  item_id?:    string;
  po_item_id?: string;
  description: string;
  hsn_sac?:    string;
  quantity:    number;
  unit_price:  number;
  tax_lines:   { name: string; percent: number }[];
  sort_order?: number;
}

export function calculateTotalsForService(
  items:            ServiceLineItemInput[],
  discount_percent: number = 0,
): {
  processedItems:  (ServiceLineItemInput & { tax_lines: { name: string; percent: number; tax_amount: number }[]; line_total: number })[];
  subtotal:        number;
  discount_amount: number;
  tax_total:       number;
  total:           number;
} {
  const enrichedItems = items.map((item) => {
    const base = round2((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));
    const enrichedTaxLines = (item.tax_lines ?? []).map((t) => ({
      name:       t.name,
      percent:    t.percent,
      tax_amount: round2(base * (t.percent / 100)),
    }));
    return { ...item, tax_lines: enrichedTaxLines };
  });

  const result = calculateTotals({
    items: enrichedItems.map((item) => ({
      quantity:   item.quantity,
      unit_price: item.unit_price,
      tax_lines:  item.tax_lines,
    })),
    discount_percent,
  });

  const processedItems = enrichedItems.map((item, idx) => ({
    ...item,
    line_total: result.line_totals[idx].line_total,
  }));

  return {
    processedItems,
    subtotal:        result.subtotal,
    discount_amount: result.discount_amount,
    tax_total:       result.tax_total,
    total:           result.grand_total,
  };
}