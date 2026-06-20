/**
 * Rounds a number to exactly 2 decimal places using standard half-up rounding.
 *
 * Why not Math.round(n * 100) / 100?
 * JS floating point makes (1.005 * 100) = 100.49999... so Math.round gives 100
 * instead of 101. Using toFixed(2) then parseFloat is the idiomatic JS fix
 * and matches exactly how the existing invoice route uses `.toFixed(2)`.
 *
 * This is intentionally simple (not true banker's rounding) to match the
 * existing system. If true banker's rounding (round half to even) is needed
 * for compliance, replace the implementation here — all callers automatically
 * benefit without changes.
 */
export function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

/**
 * Rounds to N decimal places. Use for intermediate calculations only.
 * Final values stored in DB should always use round2().
 */
export function roundN(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return parseFloat((Math.round(n * factor) / factor).toFixed(decimals));
}
