/**
 * Snapshot utilities
 *
 * A "snapshot" is a point-in-time copy of a mutable entity (Customer, Vendor)
 * stored as JSONB on the document that references it.
 *
 * Purpose: historical documents must never be affected by future edits to
 * the customer or vendor. The existing system already does this for customers
 * in route-invoice.ts. These utilities formalise and extend that pattern.
 *
 * Design rule: snapshots are plain objects (no class instances, no DB refs).
 * They are serialised to JSON and stored in Prisma Json fields.
 */

// ─── Customer snapshot ────────────────────────────────────────────────────────

/**
 * The frozen shape of a customer at the time of invoice creation.
 * Matches ICustomerSnapshot from models/Invoice.ts exactly so existing
 * invoices read without transformation.
 */
export interface CustomerSnapshot {
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

/**
 * Creates a CustomerSnapshot from a Prisma Customer record.
 * Call this on every invoice create/update — never reference the live customer.
 */
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
    id: customer.id,
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

// ─── Vendor snapshot ──────────────────────────────────────────────────────────

/**
 * The frozen shape of a vendor at the time of PO / vendor invoice creation.
 * Mirrors CustomerSnapshot but uses vendor-specific terminology.
 */
export interface VendorSnapshot {
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

/**
 * Creates a VendorSnapshot from a Prisma Vendor record.
 * Call this on every PO / vendor invoice create.
 */
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
    id:                 vendor.id,
    vendor_code:        vendor.vendor_code        ?? undefined,
    vendor_name:        vendor.vendor_name,
    company_name:       vendor.company_name       ?? undefined,
    email:              vendor.email              ?? undefined,
    phone:              vendor.phone              ?? undefined,
    address:            vendor.address            ?? undefined,
    billing_address_1:  vendor.billing_address_1  ?? undefined,
    billing_address_2:  vendor.billing_address_2  ?? undefined,
    city:               vendor.city               ?? undefined,
    state:              vendor.state              ?? undefined,
    postal_code:        vendor.postal_code        ?? undefined,
    gstin:              vendor.gstin              ?? undefined,
    pan:                vendor.pan                ?? undefined,
    country:            vendor.country,
    currency:           vendor.currency,
    payment_terms:      vendor.payment_terms      ?? undefined,
  };
}

// ─── Company snapshot ─────────────────────────────────────────────────────────

/**
 * Snapshot of company settings at the time of document generation.
 * Stored on PDFs only — not persisted to DB separately.
 */
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
