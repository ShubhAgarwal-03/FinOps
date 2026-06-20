import { prisma } from '../../../apps/api/src/config/prisma';
import { VendorInvoiceStatus } from '@prisma/client';

export interface CreateDisputeInput {
  vendor_invoice_id: string;
  raised_by?: string;
  reason: string;
  responsible_party: 'vendor' | 'internal' | 'unknown';
}

export interface ResolveDisputeInput {
  resolution: string;
  resolved_by?: string;
  resolution_action: 'accept_invoice' | 'request_credit_note' | 'amend_po' | 'reject_invoice';
}

// ── List ──────────────────────────────────────────────────

export async function listDisputes(vendor_invoice_id?: string) {
  return prisma.disputeRecord.findMany({
    where: {
      ...(vendor_invoice_id && { vendor_invoice_id }),
    },
    include: {
      vendor_invoice: {
        select: { invoice_number: true, vendor: { select: { vendor_name: true } } },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

// ── Get one ───────────────────────────────────────────────

export async function getDisputeById(id: string) {
  const dispute = await prisma.disputeRecord.findUnique({
    where: { id },
    include: {
      vendor_invoice: {
        include: {
          match_result: { include: { item_results: true } },
          po:  { select: { po_number: true } },
          grn: { select: { grn_number: true } },
        },
      },
    },
  });
  if (!dispute) throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });
  return dispute;
}

// ── Create ────────────────────────────────────────────────

export async function createDispute(input: CreateDisputeInput) {
  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id: input.vendor_invoice_id },
  });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });

  // Disputes can only be raised on DISPUTED status invoices
  if (invoice.status !== VendorInvoiceStatus.disputed) {
    throw Object.assign(
      new Error('Disputes can only be raised on invoices with DISPUTED match status'),
      { statusCode: 409 }
    );
  }

  return prisma.disputeRecord.create({
    data: {
      vendor_invoice_id:  input.vendor_invoice_id,
      raised_by:          input.raised_by ?? 'User',
      reason:             input.reason,
      responsible_party:  input.responsible_party,
      status:             'open',
    },
    include: { vendor_invoice: { select: { invoice_number: true } } },
  });
}

// ── Resolve ───────────────────────────────────────────────

export async function resolveDispute(id: string, input: ResolveDisputeInput) {
  const dispute = await prisma.disputeRecord.findUnique({
    where: { id },
    include: { vendor_invoice: true },
  });
  if (!dispute) throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });
  if (dispute.status === 'resolved') {
    throw Object.assign(new Error('Dispute is already resolved'), { statusCode: 409 });
  }

  return prisma.$transaction(async (tx) => {
    const resolved = await tx.disputeRecord.update({
      where: { id },
      data: {
        status:            'resolved',
        resolution:        input.resolution,
        resolved_by:       input.resolved_by ?? 'User',
        resolved_at:       new Date(),
        resolution_action: input.resolution_action,
      },
    });

    // Drive invoice to correct next state based on resolution action
    let nextInvoiceStatus: VendorInvoiceStatus | null = null;

    if (input.resolution_action === 'accept_invoice') {
      // Treat as matched — finance can now approve
      nextInvoiceStatus = VendorInvoiceStatus.matched;
    } else if (input.resolution_action === 'reject_invoice') {
      nextInvoiceStatus = VendorInvoiceStatus.cancelled;
    }
    // 'request_credit_note' and 'amend_po' leave invoice in disputed
    // state until re-matched after correction

    if (nextInvoiceStatus) {
      await tx.vendorInvoice.update({
        where: { id: dispute.vendor_invoice_id },
        data:  { status: nextInvoiceStatus },
      });
    }

    return resolved;
  });
}