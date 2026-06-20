// ─── Base address ─────────────────────────────────────────────────────────────

/**
 * Generic postal address used across customers, vendors, and company settings.
 * Mirrors the fields already present on the Customer Mongoose model.
 */
export interface Address {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
}

// ─── GST-enriched address ─────────────────────────────────────────────────────

/**
 * Address with Indian tax identifiers.
 * Used in customer/vendor snapshots and company settings.
 *
 * `state` is critical for GST determination:
 *   supplier.state === buyer.state → intrastate (CGST + SGST)
 *   supplier.state !== buyer.state → interstate (IGST)
 */
export interface GSTAddress extends Address {
  gstin?: string;
  pan?: string;
  /** State code used for CGST/SGST vs IGST determination */
  state: string;
}
