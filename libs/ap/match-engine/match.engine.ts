import { Prisma, MatchStatus, VendorInvoiceStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';

// ── Types ─────────────────────────────────────────────────

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
  grn_id:            string;
  status:            MatchStatus;
  overall_matched:   boolean;
  item_results:      MatchItemDetail[];
  summary:           string;
}

// ── Core algorithm ────────────────────────────────────────
/**
 * 3-way match: PO qty === GRN qty === Invoice qty (exact equality, MVP).
 *
 * Iterates over PO items (source of truth).
 * Looks up matching GRN item and vendor invoice item by po_item_id.
 * Overall result = MATCHED only if every line matches.
 */
export function computeMatch(
  poItems:      { id: string; description: string; quantity: Prisma.Decimal }[],
  grnItems:     { po_item_id: string; quantity_received: Prisma.Decimal }[],
  invoiceItems: { po_item_id: string; quantity_billed: Prisma.Decimal }[], // ← quantity_billed, not quantity
): MatchItemDetail[] {
  const grnByPoItem     = new Map(grnItems.map((g) => [g.po_item_id, g]));
  const invoiceByPoItem = new Map(invoiceItems.map((i) => [i.po_item_id, i]));

  return poItems.map((poItem) => {
    const po_quantity      = Number(poItem.quantity);
    const grnItem          = grnByPoItem.get(poItem.id);
    const invoiceItem      = invoiceByPoItem.get(poItem.id);
    const grn_quantity     = grnItem     ? Number(grnItem.quantity_received) : 0;
    const invoice_quantity = invoiceItem ? Number(invoiceItem.quantity_billed) : 0; // ← quantity_billed

    const po_grn_match      = po_quantity === grn_quantity;
    const grn_invoice_match = grn_quantity === invoice_quantity;
    const is_matched        = po_grn_match && grn_invoice_match;

    let discrepancy_note: string | null = null;
    if (!is_matched) {
      const parts: string[] = [];
      if (!po_grn_match)      parts.push(`PO qty (${po_quantity}) ≠ GRN qty (${grn_quantity})`);
      if (!grn_invoice_match) parts.push(`GRN qty (${grn_quantity}) ≠ Invoice qty (${invoice_quantity})`);
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
/**
 * Fetches all required data, runs computeMatch, persists the result,
 * and updates the vendor invoice status atomically.
 *
 * GRN is fetched via the PO (not directly from vendor invoice — no such relation).
 * MatchResult stores line_item_results as a Json column (no child table).
 */
export async function runAndPersistMatch(
  vendor_invoice_id: string
): Promise<MatchResultPayload> {

  // 1. Load vendor invoice + its items + its PO + PO items
  const invoice = await prisma.vendorInvoice.findUnique({
    where:   { id: vendor_invoice_id },
    include: {
      items: true,
      po: {
        include: { items: true, grns: { include: { items: true } } },
      },
    },
  });

  if (!invoice) {
    throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  }

  // 2. Use void instead of cancelled — matches your VendorInvoiceStatus enum
  if (invoice.status === VendorInvoiceStatus.void) {
    throw Object.assign(new Error('Cannot match a voided invoice'), { statusCode: 409 });
  }

  // 3. GRN lives on the PO, not on the invoice — find the confirmed GRN
  const confirmedGrn = invoice.po.grns.find((g) => g.status === 'confirmed');
  if (!confirmedGrn) {
    throw Object.assign(
      new Error('No confirmed GRN found for this PO. Confirm the GRN before matching.'),
      { statusCode: 409 }
    );
  }

  // 4. Run the algorithm
  const itemResults = computeMatch(
    invoice.po.items,
    confirmedGrn.items,
    invoice.items, // VendorInvoiceItem[] — uses quantity_billed internally
  );

  const overall_matched = itemResults.every((r) => r.is_matched);
  const matchStatus: MatchStatus = overall_matched ? MatchStatus.matched : MatchStatus.mismatched;

  const mismatches = itemResults.filter((r) => !r.is_matched);
  const summary = overall_matched
    ? `All ${itemResults.length} line item(s) matched exactly.`
    : `${mismatches.length} of ${itemResults.length} line item(s) mismatched: ${
        mismatches.map((m) => `${m.description} — ${m.discrepancy_note}`).join(' | ')
      }`;

  // 5. Persist in a transaction
  //    - MatchResult has NO child table — line_item_results is a Json column
  //    - MatchResult has NO po_id, overall_matched, or summary columns per schema
  await prisma.$transaction(async (tx) => {
    // Delete previous match result if re-running
    await tx.matchResult.deleteMany({ where: { vendor_invoice_id } });

    // Create fresh match result — only columns that exist in schema
    await tx.matchResult.create({
      data: {
        vendor_invoice_id,
        grn_id:           confirmedGrn.id,
        status:           matchStatus,
        line_item_results: itemResults as unknown as Prisma.InputJsonValue, // Json column
        matched_at:       new Date(),
      },
    });

    // Advance invoice status
    const newStatus = overall_matched
      ? VendorInvoiceStatus.matched
      : VendorInvoiceStatus.mismatched;

    await tx.vendorInvoice.update({
      where: { id: vendor_invoice_id },
      data:  { status: newStatus },
    });
  });

  return {
    vendor_invoice_id,
    grn_id:         confirmedGrn.id,
    status:         matchStatus,
    overall_matched,
    item_results:   itemResults,
    summary,
  };
}