// ─────────────────────────────────────────────────────────────────────────────
// libs/shared/utils/snapshot.utils.ts
//
// FIX: CustomerSnapshot and VendorSnapshot now include an index signature
// [key: string]: unknown. Without it Prisma rejects assignment to Json /
// InputJsonValue fields with:
//   "Type 'VendorSnapshot' is not assignable to type 'InputJsonObject'.
//    Index signature for type 'string' is missing in type 'VendorSnapshot'."
// The index signature does not change runtime behaviour — it just tells TS
// these are plain serialisable objects, which they are.
// ─────────────────────────────────────────────────────────────────────────────

// ── Customer snapshot ─────────────────────────────────────────────────────────
export interface CustomerSnapshot {
  [key: string]: unknown;   // required for Prisma Json field assignability
  id: string;
  customer_code?: string;
  customer_type: 'individual' | 'business';
  customer_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  gstin?: string;
  pan?: string;
  registration_number?: string;
  country: string;
  currency: string;
}

export function snapshotCustomer(customer: {
  id: string;
  customer_code?: string | null;
  customer_type: string;
  customer_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  billing_address_1?: string | null;
  billing_address_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  gstin?: string | null;
  pan?: string | null;
  registration_number?: string | null;
  country: string;
  currency: string;
}): CustomerSnapshot {
  return {
    id:                   customer.id,
    customer_code:        customer.customer_code        ?? undefined,
    customer_type:        customer.customer_type as 'individual' | 'business',
    customer_name:        customer.customer_name,
    company_name:         customer.company_name         ?? undefined,
    email:                customer.email                ?? undefined,
    phone:                customer.phone                ?? undefined,
    address:              customer.address              ?? undefined,
    billing_address_1:    customer.billing_address_1    ?? undefined,
    billing_address_2:    customer.billing_address_2    ?? undefined,
    city:                 customer.city                 ?? undefined,
    state:                customer.state                ?? undefined,
    postal_code:          customer.postal_code          ?? undefined,
    gstin:                customer.gstin                ?? undefined,
    pan:                  customer.pan                  ?? undefined,
    registration_number:  customer.registration_number  ?? undefined,
    country:              customer.country,
    currency:             customer.currency,
  };
}

// ── Vendor snapshot ───────────────────────────────────────────────────────────
export interface VendorSnapshot {
  [key: string]: unknown;   // required for Prisma Json field assignability
  id: string;
  vendor_code?: string;
  vendor_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  gstin?: string;
  pan?: string;
  country: string;
  currency: string;
  payment_terms?: string;
}

export function snapshotVendor(vendor: {
  id: string;
  vendor_code?: string | null;
  vendor_name: string;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  billing_address_1?: string | null;
  billing_address_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  gstin?: string | null;
  pan?: string | null;
  country: string;
  currency: string;
  payment_terms?: string | null;
}): VendorSnapshot {
  return {
    id:                vendor.id,
    vendor_code:       vendor.vendor_code       ?? undefined,
    vendor_name:       vendor.vendor_name,
    company_name:      vendor.company_name      ?? undefined,
    email:             vendor.email             ?? undefined,
    phone:             vendor.phone             ?? undefined,
    address:           vendor.address           ?? undefined,
    billing_address_1: vendor.billing_address_1 ?? undefined,
    billing_address_2: vendor.billing_address_2 ?? undefined,
    city:              vendor.city              ?? undefined,
    state:             vendor.state             ?? undefined,
    postal_code:       vendor.postal_code       ?? undefined,
    gstin:             vendor.gstin             ?? undefined,
    pan:               vendor.pan               ?? undefined,
    country:           vendor.country,
    currency:          vendor.currency,
    payment_terms:     vendor.payment_terms     ?? undefined,
  };
}

// ── Company snapshot ──────────────────────────────────────────────────────────
// PDF only — not persisted to DB.
export interface CompanySnapshot {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch?: string;
}