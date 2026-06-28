// ─────────────────────────────────────────────────────────────────────────────
// apps/web/lib/api/query-params.ts
//
// Shared by every AP (and AR) frontend API client: grn, purchase-orders,
// requisitions, rfp, vendor-invoices, vendor-payments, vendors, etc.
//
// PROBLEM THIS FIXES:
// Each service file defines its own narrow filter interface, e.g.:
//   export interface GRNFilters { status?: string; po_id?: string; page?: number }
//
// Passing that directly into a function typed as Record<string, unknown> fails
// TS structural typing, because a closed interface has no index signature:
//   "Index signature for type 'string' is missing in type 'GRNFilters'"
//
// `object` accepts ANY plain object shape (no index signature required), and
// Object.entries works on any object regardless of its declared type. This is
// the correct signature for "accept whatever filter shape you give me and
// just read its keys" — which is all this function ever actually does.
// ─────────────────────────────────────────────────────────────────────────────

export function buildParams(filters: object = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  return params.toString();
}