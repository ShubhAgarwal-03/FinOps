import { Prisma, MatchStatus, VendorInvoiceStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';

export interface MatchItemDetail {
  po_item_id:       string;
  description:      string;
  po_quantity:      number;
  grn_quantity:     number;
  invoice_quantity: number;
  is_matched:       boolean;
  discrepancy_note: string | null;
}

export interface MatchResultPayload {
  vendor_invoice_id: string;
  status:            MatchStatus;
  overall_matched:   boolean;
  item_results:      MatchItemDetail[];
  summary:           string;
}

/**
 * 3-way match: PO qty === (sum of received qty across all confirmed GRNs
 * for this PO) === Invoice qty. Exact equality, MVP.
 *
 * grnItems here is the AGGREGATE across every confirmed GRN for the PO,
 * not one single GRN — this is what makes the match meaningful once
 * invoices are only created after full receipt.
 */
export function computeMatch(
  poItems:      { id: string; description: string; quantity: Prisma.Decimal }[],
  grnItems:     { po_item_id: string; quantity_received: Prisma.Decimal }[],
  invoiceItems: { po_item_id: string; quantity_billed: Prisma.Decimal }[],
): MatchItemDetail[] {
  // Sum received quantity per po_item_id across all GRNs passed in.
  const grnQtyByPoItem = new Map<string, number>();
  for (const g of grnItems) {
    const prev = grnQtyByPoItem.get(g.po_item_id) ?? 0;
    grnQtyByPoItem.set(g.po_item_id, prev + Number(g.quantity_received));
  }
  const invoiceByPoItem = new Map(invoiceItems.map((i) => [i.po_item_id, i]));

  return poItems.map((poItem) => {
    const po_quantity      = Number(poItem.quantity);
    const grn_quantity     = grnQtyByPoItem.get(poItem.id) ?? 0;
    const invoiceItem      = invoiceByPoItem.get(poItem.id);
    const invoice_quantity = invoiceItem ? Number(invoiceItem.quantity_billed) : 0;

    const po_grn_match      = po_quantity === grn_quantity;
    const grn_invoice_match = grn_quantity === invoice_quantity;
    const is_matched        = po_grn_match && grn_invoice_match;

    let discrepancy_note: string | null = null;
    if (!is_matched) {
      const parts: string[] = [];
      if (!po_grn_match)      parts.push(`PO qty (${po_quantity}) ≠ received qty (${grn_quantity})`);
      if (!grn_invoice_match) parts.push(`Received qty (${grn_quantity}) ≠ Invoice qty (${invoice_quantity})`);
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

export async function runAndPersistMatch(
  vendor_invoice_id: string
): Promise<MatchResultPayload> {
  const invoice = await prisma.vendorInvoice.findUnique({
    where:   { id: vendor_invoice_id },
    include: {
      items: true,
      po: {
        include: {
          items: true,
          grns: { where: { status: 'confirmed' }, include: { items: true } },
        },
      },
    },
  });

  if (!invoice) {
    throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  }
  if (invoice.status === VendorInvoiceStatus.void) {
    throw Object.assign(new Error('Cannot match a voided invoice'), { statusCode: 409 });
  }
  if (invoice.po.grns.length === 0) {
    throw Object.assign(
      new Error('No confirmed GRNs found for this PO. Confirm at least one GRN before matching.'),
      { statusCode: 409 }
    );
  }

  // Flatten all items across every confirmed GRN for this PO — this is the
  // aggregate that computeMatch() sums per po_item_id.
  const allGrnItems = invoice.po.grns.flatMap((g) => g.items);

  const itemResults = computeMatch(invoice.po.items, allGrnItems, invoice.items);

  const overall_matched = itemResults.every((r) => r.is_matched);
  const matchStatus: MatchStatus = overall_matched ? MatchStatus.matched : MatchStatus.mismatched;

  const mismatches = itemResults.filter((r) => !r.is_matched);
  const summary = overall_matched
    ? `All ${itemResults.length} line item(s) matched exactly.`
    : `${mismatches.length} of ${itemResults.length} line item(s) mismatched: ${
        mismatches.map((m) => `${m.description} — ${m.discrepancy_note}`).join(' | ')
      }`;

  // MatchResult.grn_id is a required column in schema — since matching is
  // now PO-wide, we store the most recently confirmed GRN as a best-effort
  // audit pointer, not as something matching logic depends on.
  const mostRecentGrn = invoice.po.grns.reduce((latest, g) =>
    (!latest || (g.received_at ?? g.created_at) > (latest.received_at ?? latest.created_at)) ? g : latest
  );

  await prisma.$transaction(async (tx) => {
    await tx.matchResult.deleteMany({ where: { vendor_invoice_id } });
    await tx.matchResult.create({
      data: {
        vendor_invoice_id,
        grn_id:             mostRecentGrn.id,
        status:             matchStatus,
        line_item_results:  itemResults as unknown as Prisma.InputJsonValue,
        matched_at:         new Date(),
      },
    });
    const newStatus = overall_matched ? VendorInvoiceStatus.matched : VendorInvoiceStatus.mismatched;
    await tx.vendorInvoice.update({ where: { id: vendor_invoice_id }, data: { status: newStatus } });
  });

  return {
    vendor_invoice_id,
    status:          matchStatus,
    overall_matched,
    item_results:    itemResults,
    summary,
  };
}