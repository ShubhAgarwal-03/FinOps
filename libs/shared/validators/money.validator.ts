import { z } from 'zod';

// ─── Tax line ─────────────────────────────────────────────────────────────────

export const TaxLineSchema = z.object({
  tax_id:     z.string().optional(),
  name:       z.string().min(1, 'Tax name required'),
  percent:    z.number().min(0).max(100),
  tax_amount: z.number().min(0),
});

// ─── Line item (used on both AR invoices and AP purchase orders) ──────────────

export const LineItemSchema = z.object({
  item_id:    z.string().optional(),           // reference to catalogue
  description: z.string().min(1, 'Description required'),
  hsn_sac:    z.string().optional(),
  quantity:   z.number().min(0.001, 'Quantity must be > 0'),
  unit_price: z.number().min(0, 'Unit price must be ≥ 0'),
  /**
   * tax_lines are computed server-side by gst-calculator.
   * On create/update requests the client sends gst_rate_percent only.
   * tax_lines are accepted here for internal use (re-validation, updates).
   */
  tax_lines:  z.array(TaxLineSchema).optional().default([]),
  line_total: z.number().optional(),           // computed, accepted but not trusted
});

export type LineItemInput = z.infer<typeof LineItemSchema>;

// ─── Document-level discount ──────────────────────────────────────────────────

export const DiscountSchema = z.object({
  discount_percent: z.number().min(0).max(100).default(0),
});

// ─── Money amount ─────────────────────────────────────────────────────────────

export const MoneyAmountSchema = z
  .number({ required_error: 'Amount required' })
  .positive('Amount must be greater than 0')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places');
