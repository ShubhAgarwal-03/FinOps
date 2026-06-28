// ─────────────────────────────────────────────────────────────────────────────
// libs/ap/vendors/vendors.services.ts
// ─────────────────────────────────────────────────────────────────────────────
import { Prisma, POStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { snapshotVendor } from '../../shared/utils/snapshot.utils';
import { getCurrencyForCountry } from '../../shared/utils/currency.utils';

export interface VendorListQuery {
  search?: string;
  page?: string;
  limit?: string;
}

export interface CreateVendorInput {
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
  country?: string;
  gstin?: string;
  pan?: string;
  payment_terms?: string;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

// ── List ──────────────────────────────────────────────────────────────────────
export async function listVendors(query: VendorListQuery) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.VendorWhereInput = {
    is_deleted: false,
    ...(query.search && {
      OR: [
        { vendor_name:  { contains: query.search, mode: 'insensitive' } },
        { company_name: { contains: query.search, mode: 'insensitive' } },
        { email:        { contains: query.search, mode: 'insensitive' } },
        { gstin:        { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [vendors, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      include: {
        _count: { select: { purchase_orders: true, vendor_invoices: true } },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  return { vendors, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ── Get one ───────────────────────────────────────────────────────────────────
export async function getVendorById(id: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id, is_deleted: false },
  });
  if (!vendor) throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });
  return vendor;
}

// ── Create ────────────────────────────────────────────────────────────────────
export async function createVendor(input: CreateVendorInput) {
  if (!input.vendor_name) {
    throw Object.assign(new Error('vendor_name is required'), { statusCode: 400 });
  }
  const country  = input.country ?? 'IN';
  const currency = getCurrencyForCountry(country);
  return prisma.vendor.create({
    data: { ...input, country, currency },
  });
}

// ── Update ────────────────────────────────────────────────────────────────────
export async function updateVendor(id: string, input: UpdateVendorInput) {
  const existing = await prisma.vendor.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });

  const updates: Prisma.VendorUpdateInput = { ...input };
  if (input.country) updates.currency = getCurrencyForCountry(input.country);

  return prisma.vendor.update({ where: { id }, data: updates });
}

// ── Soft delete ───────────────────────────────────────────────────────────────
// FIX: was checking { in: ['draft', 'issued', 'amended'] } — 'amended' does
// not exist in POStatus. Active PO states are draft and issued only.
export async function deleteVendor(id: string) {
  const existing = await prisma.vendor.findFirst({ where: { id, is_deleted: false } });
  if (!existing) throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });

  const activePOs = await prisma.purchaseOrder.count({
    where: {
      vendor_id: id,
      status:    { in: [POStatus.draft, POStatus.issued] },
    },
  });
  if (activePOs > 0) {
    throw Object.assign(
      new Error('Cannot delete vendor with active purchase orders'),
      { statusCode: 409 },
    );
  }

  return prisma.vendor.update({
    where: { id },
    data:  { is_deleted: true, deleted_at: new Date() },
  });
}

// ── Ledger ────────────────────────────────────────────────────────────────────
export async function getVendorLedger(vendorId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, is_deleted: false },
  });
  if (!vendor) throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });

  const entries = await prisma.vendorLedger.findMany({
    where:   { vendor_id: vendorId },
    orderBy: [{ entry_date: 'asc' }, { created_at: 'asc' }],
    include: { vendor_invoice: { select: { invoice_number: true } } },
  });

  let balance = 0;
  const rows = entries.map((e) => {
    const debit  = e.direction === 'DEBIT'  ? Number(e.amount) : 0;
    const credit = e.direction === 'CREDIT' ? Number(e.amount) : 0;
    balance = parseFloat((balance + debit - credit).toFixed(2));
    return {
      id:             e.id,
      date:           e.entry_date,
      description:    e.description,
      invoice_number: e.vendor_invoice?.invoice_number ?? e.reference_number,
      type:           e.entry_type,
      debit,
      credit,
      balance,
    };
  });

  const total_invoiced = rows
    .filter((r) => r.type === 'INVOICE_RECEIVED')
    .reduce((s, r) => s + r.debit, 0);
  const total_paid = rows
    .filter((r) => r.type === 'PAYMENT_MADE')
    .reduce((s, r) => s + r.credit, 0);

  return {
    vendor,
    rows,
    summary: {
      total_invoiced:  parseFloat(total_invoiced.toFixed(2)),
      total_paid:      parseFloat(total_paid.toFixed(2)),
      closing_balance: balance,
      currency:        vendor.currency,
    },
  };
}

export { snapshotVendor };