import { round2 } from '../../utils/round.utils';
import type { TaxLine } from '../../types/money.types';
import type { GSTCalcInput, GSTCalcResult, GSTSummaryInput } from './gst.types';
import type { TaxSummary } from '../../types/money.types';

/**
 * Calculates GST tax lines for a single line item.
 *
 * IGST  → one TaxLine at the full rate
 * CGST+SGST → two TaxLines each at half the rate
 *
 * The existing system stores taxes as an array per line item (ILineItemTax[]).
 * This function produces exactly that array.
 *
 * @example — Interstate 18% GST on ₹1000
 *   calculateGST({ taxable_amount: 1000, gst_rate_percent: 18, gst_type: 'IGST' })
 *   // → { tax_lines: [{ name:'IGST', percent:18, tax_amount:180 }], total_tax: 180 }
 *
 * @example — Intrastate 18% GST on ₹1000
 *   calculateGST({ taxable_amount: 1000, gst_rate_percent: 18, gst_type: 'CGST_SGST' })
 *   // → {
 *   //      tax_lines: [
 *   //        { name:'CGST', percent:9, tax_amount:90 },
 *   //        { name:'SGST', percent:9, tax_amount:90 }
 *   //      ],
 *   //      total_tax: 180
 *   //    }
 */
export function calculateGST(input: GSTCalcInput): GSTCalcResult {
  const { taxable_amount, gst_rate_percent, gst_type } = input;

  if (gst_rate_percent === 0) {
    return { tax_lines: [], total_tax: 0 };
  }

  if (gst_type === 'IGST') {
    const tax_amount = round2(taxable_amount * (gst_rate_percent / 100));
    const line: TaxLine = {
      name: 'IGST',
      percent: gst_rate_percent,
      tax_amount,
    };
    return { tax_lines: [line], total_tax: tax_amount };
  }

  // CGST + SGST — each gets exactly half the rate
  // Use banker's rounding on each half; total is their sum (may differ from
  // round2(taxable * full_rate / 100) by 1 paisa — this is correct behaviour)
  const half_rate = gst_rate_percent / 2;
  const half_tax = round2(taxable_amount * (half_rate / 100));

  const cgst: TaxLine = { name: 'CGST', percent: half_rate, tax_amount: half_tax };
  const sgst: TaxLine = { name: 'SGST', percent: half_rate, tax_amount: half_tax };

  return {
    tax_lines: [cgst, sgst],
    total_tax: round2(half_tax + half_tax),
  };
}

/**
 * Builds a document-level TaxSummary from all TaxLines across all line items.
 * Used for the GST breakdown block in PDFs and invoice detail views.
 *
 * Matches the existing PDF rendering logic in pdfService.ts:
 *   if (isInterstate) → show IGST total
 *   else              → show CGST + SGST totals
 */
export function buildTaxSummary(input: GSTSummaryInput): TaxSummary {
  const { is_interstate, all_tax_lines } = input;

  let igst_total = 0;
  let cgst_total = 0;
  let sgst_total = 0;

  for (const line of all_tax_lines) {
    const name = line.name.toUpperCase();
    if (name === 'IGST')      igst_total = round2(igst_total + line.tax_amount);
    else if (name === 'CGST') cgst_total = round2(cgst_total + line.tax_amount);
    else if (name === 'SGST') sgst_total = round2(sgst_total + line.tax_amount);
  }

  const grand_tax_total = round2(igst_total + cgst_total + sgst_total);

  return { is_interstate, igst_total, cgst_total, sgst_total, grand_tax_total };
}
