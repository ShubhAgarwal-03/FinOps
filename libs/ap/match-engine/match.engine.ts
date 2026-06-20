import { Prisma, MatchStatus, VendorInvoiceStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';

// ── Types ─────────────────────────────────────────────────

export interface MatchItemDetail {
  po_item_id:         string;
  description:        string;
  po_quantity:        number;
  grn_quantity:       number;
  invoice_quantity:   number;
  is_matched:         boolean;
  discrepancy_note:   string | null;
}

export interface MatchResultPayload {
  vendor_invoice_id: string;
  status:            MatchStatus;
  overall_matched:   boolean;
  item_results:      MatchItemDetail[];
  summary:           string;
}

// ── Core algorithm ────────────────────────────────────────

/**
 * 3-way match: PO qty === GRN qty === Invoice qty (exact equality, MVP).
 *
 * For each vendor invoice item:
 *   1. Find the corresponding PO item.
 *   2. Find the corresponding GRN item for that PO item.
 *   3. Compare all three quantities exactly.
 *
 * Overall result is MATCHED only if every line item matches.
 */
export function computeMatch(
  poItems:      { id: string; description: string; quantity: Prisma.Decimal }[],
  grnItems:     { po_item_id: string; quantity_received: Prisma.Decimal }[],
  invoiceItems: { po_item_id: string; quantity: Prisma.Decimal }[],
): MatchItemDetail[] {
  // Index GRN and invoice items by po_item_id for O(1) lookup
  const grnByPoItem     = new Map(grnItems.map((g) => [g.po_item_id, g]));
  const invoiceByPoItem = new Map(invoiceItems.map((i) => [i.po_item_id, i]));

  return poItems.map((poItem) => {
    const po_quantity      = Number(poItem.quantity);
    const grnItem          = grnByPoItem.get(poItem.id);
    const invoiceItem      = invoiceByPoItem.get(poItem.id);

    const grn_quantity     = grnItem     ? Number(grnItem.quantity_received) : 0;
    const invoice_quantity = invoiceItem ? Number(invoiceItem.quantity)       : 0;

    const po_grn_match      = po_quantity === grn_quantity;
    const grn_invoice_match = grn_quantity === invoice_quantity;
    const is_matched        = po_grn_match && grn_invoice_match;

    let discrepancy_note: string | null = null;
    if (!is_matched) {
      const parts: string[] = [];
      if (!po_grn_match) {
        parts.push(`PO qty (${po_quantity}) ≠ GRN qty (${grn_quantity})`);
      }
      if (!grn_invoice_match) {
        parts.push(`GRN qty (${grn_quantity}) ≠ Invoice qty (${invoice_quantity})`);
      }
      discrepancy_note = parts.join('; ');
    }

    return {
      po_item_id:       poItem.id,
      description:      poItem.description,
      po_quantity,
      grn_quantity,
      invoice_quantity,
      is_matched,
      discrepancy_note,
    };
  });
}

// ── Persist match result + update invoice status ──────────

export async function runAndPersistMatch(
  vendor_invoice_id: string
): Promise<MatchResultPayload> {
  // Load vendor invoice with all related data
  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id: vendor_invoice_id },
    include: {
      items: true,
      po: {
        include: { items: true },
      },
      grn: {
        include: { items: true },
      },
    },
  });

  if (!invoice) {
    throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  }
  if (!invoice.grn) {
    throw Object.assign(new Error('No GRN linked to this vendor invoice'), { statusCode: 409 });
  }
  if (invoice.status === VendorInvoiceStatus.cancelled) {
    throw Object.assign(new Error('Cannot match a cancelled invoice'), { statusCode: 409 });
  }

  // Run the algorithm
  const itemResults = computeMatch(
    invoice.po.items,
    invoice.grn.items,
    invoice.items,
  );

  const overall_matched = itemResults.every((r) => r.is_matched);
  const matchStatus: MatchStatus = overall_matched
    ? MatchStatus.matched
    : MatchStatus.mismatched;

  const mismatches = itemResults.filter((r) => !r.is_matched);
  const summary = overall_matched
    ? `All ${itemResults.length} line item(s) matched exactly.`
    : `${mismatches.length} of ${itemResults.length} line item(s) mismatched: ${
        mismatches.map((m) => `${m.description} — ${m.discrepancy_note}`).join(' | ')
      }`;

  // Persist in transaction
  await prisma.$transaction(async (tx) => {
    // Delete previous match result if re-running
    await tx.matchResult.deleteMany({ where: { vendor_invoice_id } });

    // Create fresh match result with line-item details
    await tx.matchResult.create({
      data: {
        vendor_invoice_id,
        po_id:            invoice.po_id,
        grn_id:           invoice.grn_id!,
        status:           matchStatus,
        overall_matched,
        summary,
        matched_at:       new Date(),
        item_results: {
          create: itemResults.map((r) => ({
            po_item_id:       r.po_item_id,
            description:      r.description,
            po_quantity:      new Prisma.Decimal(r.po_quantity),
            grn_quantity:     new Prisma.Decimal(r.grn_quantity),
            invoice_quantity: new Prisma.Decimal(r.invoice_quantity),
            is_matched:       r.is_matched,
            discrepancy_note: r.discrepancy_note,
          })),
        },
      },
    });

    // Advance invoice status based on result
    const newInvoiceStatus = overall_matched
      ? VendorInvoiceStatus.matched
      : VendorInvoiceStatus.disputed;

    await tx.vendorInvoice.update({
      where: { id: vendor_invoice_id },
      data:  { status: newInvoiceStatus },
    });
  });

  return {
    vendor_invoice_id,
    status:          matchStatus,
    overall_matched,
    item_results:    itemResults,
    summary,
  };
}