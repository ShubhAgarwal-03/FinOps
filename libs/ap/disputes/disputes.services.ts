// ─────────────────────────────────────────────────────────────────────────────
// libs/ap/disputes/disputes.services.ts
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../../../apps/api/src/config/prisma';
import { DisputeStatus, VendorInvoiceStatus } from '@prisma/client';

export interface CreateDisputeInput {
  vendor_invoice_id: string;
  raised_by?: string;
  reason: string;
  // FIX: 'unknown' is not a valid DisputeParty enum value.
  // Schema has: vendor | internal | purchase_order
  responsible_party: 'vendor' | 'internal' | 'purchase_order';
}

export interface ResolveDisputeInput {
  resolution: string;
  resolved_by?: string;
  // FIX: schema DisputeStatus has no plain 'resolved' — it has three specific
  // resolution outcomes. 'request_credit_note' was also not in the schema.
  // Maps to: resolved_accept | resolved_reject | resolved_amend_po
  resolution_action: 'accept_invoice' | 'amend_po' | 'reject_invoice';
}

// ── List ──────────────────────────────────────────────────────────────────────
export async function listDisputes(vendor_invoice_id?: string) {
  return prisma.disputeRecord.findMany({
    where: { ...(vendor_invoice_id && { vendor_invoice_id }) },
    include: {
      vendor_invoice: {
        select: {
          invoice_number: true,
          vendor: { select: { vendor_name: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

// ── Get one ───────────────────────────────────────────────────────────────────
export async function getDisputeById(id: string) {
  const dispute = await prisma.disputeRecord.findUnique({
    where: { id },
    include: {
      vendor_invoice: {
        include: {
          match_result: true,
          po:  { select: { po_number: true } },
          grn: { select: { grn_number: true } },
        },
      },
    },
  });
  if (!dispute) throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });
  return dispute;
}

// ── Create ────────────────────────────────────────────────────────────────────
// Disputes can only be raised when the vendor invoice status is 'disputed'.
// The match engine sets status to 'mismatched' after a failed match; a
// separate step (not yet in these services) should move it to 'disputed'
// to signal it is under active review. For MVP the UI can call this
// directly after a mismatch — the status guard here enforces the rule.
export async function createDispute(input: CreateDisputeInput) {
  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id: input.vendor_invoice_id },
  });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });

  if (invoice.status !== VendorInvoiceStatus.disputed) {
    throw Object.assign(
      new Error('Disputes can only be raised on invoices with DISPUTED status'),
      { statusCode: 409 },
    );
  }

  return prisma.disputeRecord.create({
    data: {
      vendor_invoice_id: input.vendor_invoice_id,
      raisedBy:         input.raised_by ?? 'User',
      reason:            input.reason,
      responsible_party: input.responsible_party,
      // FIX: DisputeStatus.open (enum value), not the string 'open'
      status:            DisputeStatus.open,
    },
    include: { vendor_invoice: { select: { invoice_number: true } } },
  });
}

// ── Resolve ───────────────────────────────────────────────────────────────────
// Resolving a dispute drives the vendor invoice to its next logical state:
//   accept_invoice  → matched  (finance can now approve for payment)
//   reject_invoice  → void     (FIX: was 'cancelled', schema has 'void')
//   amend_po        → stays disputed; PO amendment raised separately, then
//                     vendor invoice is re-submitted and re-matched
export async function resolveDispute(id: string, input: ResolveDisputeInput) {
  const dispute = await prisma.disputeRecord.findUnique({
    where: { id },
    include: { vendor_invoice: true },
  });
  if (!dispute) throw Object.assign(new Error('Dispute not found'), { statusCode: 404 });

  // FIX: checking 'resolved' (doesn't exist). Any resolved_* value means done.
  const alreadyResolved = (
    [DisputeStatus.resolved_accept,
       DisputeStatus.resolved_reject,
       DisputeStatus.resolved_amend_po] as DisputeStatus[]
  ).includes(dispute.status);
  if (alreadyResolved) {
    throw Object.assign(new Error('Dispute is already resolved'), { statusCode: 409 });
  }

  // Map resolution_action → DisputeStatus and next VendorInvoiceStatus
  const actionMap: Record<
    ResolveDisputeInput['resolution_action'],
    {
      disputeStatus:  DisputeStatus;
      invoiceStatus:  VendorInvoiceStatus | null;
    }
  > = {
    accept_invoice: {
      disputeStatus: DisputeStatus.resolved_accept,
      invoiceStatus: VendorInvoiceStatus.matched,  // bypass re-match, go direct to approvable
    },
    reject_invoice: {
      disputeStatus: DisputeStatus.resolved_reject,
      // FIX: was VendorInvoiceStatus.cancelled (doesn't exist). Schema uses void.
      invoiceStatus: VendorInvoiceStatus.void,
    },
    amend_po: {
      disputeStatus: DisputeStatus.resolved_amend_po,
      invoiceStatus: null,  // stays disputed; correction happens via PO amendment + re-match
    },
  };

  const { disputeStatus, invoiceStatus } = actionMap[input.resolution_action];

  return prisma.$transaction(async (tx) => {
    const resolved = await tx.disputeRecord.update({
      where: { id },
      data: {
        status:            disputeStatus,
        resolution:        input.resolution,
        resolved_by:       input.resolved_by ?? 'User',
        resolved_at:       new Date(),
        resolution_action: input.resolution_action,
      },
    });

    if (invoiceStatus !== null) {
      await tx.vendorInvoice.update({
        where: { id: dispute.vendor_invoice_id },
        data:  { status: invoiceStatus },
      });
    }

    return resolved;
  });
}