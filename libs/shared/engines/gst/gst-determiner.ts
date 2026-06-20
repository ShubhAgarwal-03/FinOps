import type { GSTDeterminerInput, GSTType } from './gst.types';

/**
 * Determines whether a transaction is interstate (IGST) or
 * intrastate (CGST + SGST) based on supplier and buyer states.
 *
 * Rules (Indian GST):
 *   - Same state → intrastate → CGST + SGST
 *   - Different states → interstate → IGST
 *   - Missing state on either side → default to interstate (conservative)
 *
 * The existing system stores `is_interstate: boolean` on the invoice.
 * This function is the single source of truth for computing that flag.
 *
 * @example
 *   determineGSTType({ supplier_state: 'Karnataka', buyer_state: 'Karnataka' })
 *   // → 'CGST_SGST'
 *
 *   determineGSTType({ supplier_state: 'Karnataka', buyer_state: 'Maharashtra' })
 *   // → 'IGST'
 */
export function determineGSTType(input: GSTDeterminerInput): GSTType {
  const { supplier_state, buyer_state } = input;

  // If either state is unknown, treat as interstate (never under-collect)
  if (!supplier_state?.trim() || !buyer_state?.trim()) {
    return 'IGST';
  }

  const normalise = (s: string) => s.trim().toLowerCase();

  return normalise(supplier_state) === normalise(buyer_state)
    ? 'CGST_SGST'
    : 'IGST';
}

/**
 * Convenience: given the two states, return the boolean
 * `is_interstate` flag compatible with the existing invoice schema.
 */
export function isInterstateSupply(
  supplier_state: string | undefined | null,
  buyer_state: string | undefined | null,
): boolean {
  return determineGSTType({ supplier_state, buyer_state }) === 'IGST';
}
