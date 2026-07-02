// ─────────────────────────────────────────────────────────────────────────────
// libs/ap/purchase-orders/po.services.ts
//
// PurchaseOrder status is DOCUMENT-INTEGRITY ONLY: draft → issued → cancelled.
// It never reflects delivery/fulfillment — that lives entirely on GRN records.
// Once issued, a PO is immutable. Corrections are append-only POAmendment rows
// that reference the original PO; the PO row itself is never mutated again
// (except the single issued → cancelled transition).
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma, POStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';
import { snapshotVendor } from '../../shared/utils/snapshot.utils';
import { calculateTotals, type LineItemInput } from '../../shared/engines/totals/totals-calculator';
import { calculateGST } from '../../shared/engines/gst/gst-calculator';
import type { TaxLine } from '../../shared/types/money.types';

// ── Input types ────────────────────────────────────────────────────────────

export interface POItemInput {
  item_id?: string;
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  /** Raw tax rate lines as entered by the user, e.g. [{ name: 'GST', percent: 18 }] */
  tax_lines: { name: string; percent: number }[];
  sort_order?: number;
}

interface TotalsResult {
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_total: number;
  grand_total: number;
  line_totals: { line_total: number }[];
}

export interface CreatePOInput {
  vendor_id: string;
  rfp_id?: string;
  is_interstate?: boolean;
  discount_percent?: number;
  delivery_address?: string;
  expected_delivery?: Date;
  payment_terms?: string;
  notes?: string;
  items: POItemInput[];
}

export interface AmendPOInput {
  reason: string;
  /** Structured diff: [{ field, old_value, new_value }] */
  changes: { field: string; old_value: unknown; new_value: unknown }[];
  amended_by?: string;
}

// ── Helper: turn raw per-item tax rate lines into priced TaxLine[] ──────────
//
// Each PO item may carry one or more named tax rate entries (e.g. a single
// "GST 18%" line, or — if the caller already split it — separate CGST/SGST
// lines). We sum the rate percentages per item, then run the combined rate
// through calculateGST so IGST vs CGST/SGST splitting and rounding is done
// in exactly one place (the shared engine), never hand-rolled here.
function buildPricedTaxLines(
  taxable_amount: number,
  rawTaxLines: { name: string; percent: number }[],
  is_interstate: boolean,
): TaxLine[] {
  const total_rate = rawTaxLines.reduce((sum, t) => sum + (Number(t.percent) || 0), 0);
  if (total_rate <= 0) return [];

  const { tax_lines } = calculateGST({
    taxable_amount,
    gst_rate_percent: total_rate,
    gst_type: is_interstate ? 'IGST' : 'CGST_SGST',
  });
  return tax_lines;
}

// Converts raw POItemInput[] into the shape calculateTotals() needs,
// and returns both the totals result and the per-item priced tax lines
// (needed again when persisting each POItem row).
function priceItems(items: POItemInput[], is_interstate: boolean) {
  const pricedTaxLines: TaxLine[][] = [];

  const lineItemInputs: LineItemInput[] = items.map((item) => {
    const taxable_amount = item.quantity * item.unit_price;
    const taxLines = buildPricedTaxLines(taxable_amount, item.tax_lines, is_interstate);
    pricedTaxLines.push(taxLines);
    return {
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_lines: taxLines,
    };
  });

  return { lineItemInputs, pricedTaxLines };
}

// ── List ──────────────────────────────────────────────────────────────────

export async function listPurchaseOrders(query: {
  status?: string;
  vendor_id?: string;
  page?: string;
  limit?: string;
}) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.status && { status: query.status as POStatus }),
    ...(query.vendor_id && { vendor_id: query.vendor_id }),
  };

  const [purchase_orders, total] = await prisma.$transaction([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { vendor_name: true, company_name: true } },
        items: true,
        amendments: { orderBy: { created_at: 'desc' }, take: 1 },
        _count: { select: { grns: true, vendor_invoices: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { purchase_orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ── Get one ───────────────────────────────────────────────────────────────

export async function getPurchaseOrderById(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor: true,
      items: { include: { item: true } },
      amendments: { orderBy: { created_at: 'asc' } },
      grns: { include: { items: true } },
      vendor_invoices: { select: { id: true, invoice_number: true, status: true } },
    },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
  return po;
}

// ── Create (DRAFT) ───────────────────────────────────────────────────────

export async function createPurchaseOrder(input: CreatePOInput) {
  if (!input.items?.length) {
    throw Object.assign(new Error('At least one line item is required'), { statusCode: 400 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendor_id, is_deleted: false },
  });
  if (!vendor) throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });

  // If linked to an RFP, that RFP must already have a vendor selected.
  if (input.rfp_id) {
    const rfp = await prisma.rFP.findUnique({ where: { id: input.rfp_id } });
    if (!rfp || rfp.status !== 'vendor_selected') {
      throw Object.assign(
        new Error('RFP must be in vendor_selected status to generate a PO'),
        { statusCode: 409 },
      );
    }
  }

  const is_interstate = input.is_interstate ?? true;
  const vendor_snapshot = snapshotVendor(vendor);

  const { lineItemInputs, pricedTaxLines } = priceItems(input.items, is_interstate);
  const totals: TotalsResult = calculateTotals({
    items: lineItemInputs,
    discount_percent: input.discount_percent ?? 0,
  });

  const po_number = await generateDocumentNumber(prisma, 'PO');

  return prisma.purchaseOrder.create({
    data: {
      po_number,
      vendor_id: input.vendor_id,
      vendor_snapshot: vendor_snapshot as unknown as Prisma.InputJsonValue,
      rfp_id: input.rfp_id ?? null,
      status: POStatus.draft,
      is_interstate,
      discount_percent: new Prisma.Decimal(totals.discount_percent),
      discount_amount: new Prisma.Decimal(totals.discount_amount),
      subtotal: new Prisma.Decimal(totals.subtotal),
      tax_total: new Prisma.Decimal(totals.tax_total),
      total: new Prisma.Decimal(totals.grand_total),
      delivery_address: input.delivery_address,
      expected_delivery: input.expected_delivery,
      payment_terms: input.payment_terms,
      notes: input.notes,
      items: {
        create: input.items.map((item, idx) => ({
          item_id: item.item_id ?? null,
          description: item.description,
          hsn_sac: item.hsn_sac ?? null,
          quantity: new Prisma.Decimal(item.quantity),
          unit_price: new Prisma.Decimal(item.unit_price),
          tax_lines: pricedTaxLines[idx] as unknown as Prisma.InputJsonValue,
          line_total: new Prisma.Decimal(totals.line_totals[idx].line_total),
          sort_order: item.sort_order ?? idx,
        })),
      },
    },
    include: { items: true, vendor: true },
  });
}

// ── Update (DRAFT only) ──────────────────────────────────────────────────
//
// Direct edits are only ever allowed while status === draft. Once issued,
// this throws — corrections must go through createAmendment() instead.
// The poImmutabilityGuard middleware also blocks this route before it's
// even called, but the check is repeated here as defense in depth.

export async function updatePurchaseOrder(id: string,  input: Partial<CreatePOInput>,) {
  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing)
    throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  if (existing.status !== POStatus.draft) {
    throw Object.assign(
      new Error('Purchase order is locked after issue. Use an amendment to make corrections.'),
      { statusCode: 409 },
    );
  }

  const is_interstate = input.is_interstate ?? existing.is_interstate;

  return prisma.$transaction(async (tx) => {
    let totals: TotalsResult | undefined; 
    let pricedTaxLinesById: TaxLine[][] = [];

    if (input.items) {
      const { lineItemInputs, pricedTaxLines } = priceItems(input.items, is_interstate);
      totals = calculateTotals({
        items: lineItemInputs,
        discount_percent: input.discount_percent ?? Number(existing.discount_percent),
      });
      pricedTaxLinesById = pricedTaxLines;

      await tx.pOItem.deleteMany({ where: { po_id: id } });
      await tx.pOItem.createMany({
        data: input.items.map((item, idx) => ({
          po_id: id,
          item_id: item.item_id ?? null,
          description: item.description,
          hsn_sac: item.hsn_sac ?? null,
          quantity: new Prisma.Decimal(item.quantity),
          unit_price: new Prisma.Decimal(item.unit_price),
          tax_lines: pricedTaxLinesById[idx] as unknown as Prisma.InputJsonValue,
          line_total: new Prisma.Decimal(totals!.line_totals[idx].line_total),
          sort_order: item.sort_order ?? idx,
        })),
      });
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        is_interstate,
        discount_percent: totals
          ? new Prisma.Decimal(totals.discount_percent)
          : input.discount_percent !== undefined
            ? new Prisma.Decimal(input.discount_percent)
            : undefined,
        discount_amount: totals ? new Prisma.Decimal(totals.discount_amount) : undefined,
        subtotal: totals ? new Prisma.Decimal(totals.subtotal) : undefined,
        tax_total: totals ? new Prisma.Decimal(totals.tax_total) : undefined,
        total: totals ? new Prisma.Decimal(totals.grand_total) : undefined,
        delivery_address: input.delivery_address,
        expected_delivery: input.expected_delivery,
        payment_terms: input.payment_terms,
        notes: input.notes,
      },
      include: { items: true },
    });
  });
}

// ── Issue (DRAFT → ISSUED, locks the PO permanently) ─────────────────────

export async function issuePurchaseOrder(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  if (po.status !== POStatus.draft) {
    throw Object.assign(new Error('Purchase order is already issued or cancelled'), { statusCode: 409 });
  }
  if (!po.items.length) {
    throw Object.assign(new Error('Cannot issue a PO with no line items'), { statusCode: 400 });
  }

  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: POStatus.issued, issued_at: new Date() },
    include: { items: true, vendor: true },
  });
}

// ── Amendment (append-only branch off an ISSUED PO) ──────────────────────
//
// Never mutates the original PO's items/totals. Only ISSUED POs can be
// amended — a draft should just be edited directly, and a cancelled PO
// is dead. PO status itself never changes as a result of an amendment.

export async function createAmendment(id: string, input: AmendPOInput) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  if (po.status !== POStatus.issued) {
    throw Object.assign(
      new Error('Only ISSUED purchase orders can be amended'),
      { statusCode: 409 },
    );
  }

  const lastAmendment = await prisma.pOAmendment.findFirst({
    where: { po_id: id },
    orderBy: { amendment_number: 'desc' },
  });
  const amendment_number = (lastAmendment?.amendment_number ?? 0) + 1;

  return prisma.pOAmendment.create({
    data: {
      po_id: id,
      amendment_number,
      reason: input.reason,
      changes: input.changes as unknown as Prisma.InputJsonValue,
      amended_by: input.amended_by ?? 'User',
    },
  });
}

export async function getAmendments(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  return prisma.pOAmendment.findMany({
    where: { po_id: id },
    orderBy: { amendment_number: 'asc' },
  });
}

// ── Cancel ────────────────────────────────────────────────────────────────
//
// Allowed from draft or issued. Blocked if any confirmed GRN already
// exists against this PO — once goods have actually been received and
// confirmed, the PO can no longer be walked back; it must run its course
// (or be corrected via amendment) rather than cancelled.

export async function cancelPurchaseOrder(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { grns: true },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  if (po.status === POStatus.cancelled) {
    throw Object.assign(new Error('Purchase order is already cancelled'), { statusCode: 409 });
  }

  const confirmedGrns = po.grns.filter((g) => g.status === 'confirmed');
  if (confirmedGrns.length > 0) {
    throw Object.assign(
      new Error('Cannot cancel a PO with confirmed goods receipts'),
      { statusCode: 409 },
    );
  }

  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: POStatus.cancelled },
  });
}

// ── Fulfillment (derived — never stored) ──────────────────────────────────
//
// "How much of this PO has been delivered" is always computed fresh from
// confirmed GRN items, never cached on the PO row. Used by the PO detail
// view and as a precondition check before allowing a vendor invoice.

export interface POFulfillmentLine {
  po_item_id: string;
  description: string;
  ordered_quantity: number;
  received_quantity: number;
  is_fully_received: boolean;
}

export async function getPurchaseOrderFulfillment(id: string): Promise<{
  po_id: string;
  lines: POFulfillmentLine[];
  is_fully_received: boolean;
}> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      items: true,
      grns: {
        where: { status: 'confirmed' },
        include: { items: true },
      },
    },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  const receivedByPoItem = new Map<string, number>();
  for (const grn of po.grns) {
    for (const item of grn.items) {
      const prev = receivedByPoItem.get(item.po_item_id) ?? 0;
      receivedByPoItem.set(item.po_item_id, prev + Number(item.quantity_received));
    }
  }

  const lines: POFulfillmentLine[] = po.items.map((poItem) => {
    const received_quantity = receivedByPoItem.get(poItem.id) ?? 0;
    const ordered_quantity = Number(poItem.quantity);
    return {
      po_item_id: poItem.id,
      description: poItem.description,
      ordered_quantity,
      received_quantity,
      is_fully_received: received_quantity >= ordered_quantity,
    };
  });

  return {
    po_id: po.id,
    lines,
    is_fully_received: lines.every((l) => l.is_fully_received),
  };
}