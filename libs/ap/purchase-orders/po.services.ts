import { Prisma, POStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';
import { snapshotVendor } from '../../shared/utils/snapshot.utils';
import { calculateTotalsForService } from '../../shared/engines/totals/totals-calculator';

export interface POItemInput {
  item_id?: string;
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  tax_lines: { name: string; percent: number }[];
  sort_order?: number;
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
  description?: string;
  amended_by?: string;
}

export async function listPurchaseOrders(query: {
  status?: string; vendor_id?: string; page?: string; limit?: string;
}) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.status    && { status:    query.status    as POStatus }),
    ...(query.vendor_id && { vendor_id: query.vendor_id }),
  };

  const [pos, total] = await prisma.$transaction([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor:     { select: { vendor_name: true, company_name: true } },
        items:      true,
        amendments: { orderBy: { created_at: 'desc' }, take: 1 },
        _count:     { select: { grns: true, vendor_invoices: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { purchase_orders: pos, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getPurchaseOrderById(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      vendor:         true,
      items:          { include: { item: true } },
      amendments:     { orderBy: { created_at: 'asc' } },
      grns:           { include: { items: true } },
      vendor_invoices: { select: { id: true, invoice_number: true, status: true } },
    },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
  return po;
}

export async function createPurchaseOrder(input: CreatePOInput) {
  if (!input.items?.length) {
    throw Object.assign(new Error('At least one line item is required'), { statusCode: 400 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { id: input.vendor_id, is_deleted: false },
  });
  if (!vendor) throw Object.assign(new Error('Vendor not found'), { statusCode: 404 });

  // If linked to RFP, it must be awarded
  if (input.rfp_id) {
    const rfp = await prisma.rFP.findUnique({ where: { id: input.rfp_id } });
    if (!rfp || rfp.status !== 'awarded') {
      throw Object.assign(
        new Error('RFP must be in AWARDED status to generate a PO'),
        { statusCode: 409 }
      );
    }
  }

  const vendor_snapshot = snapshotVendor(vendor);
  const totals = calculateTotals({
  items: input.items.map((item) => ({
    quantity:   item.quantity,
    unit_price: item.unit_price,
    tax_lines:  item.tax_lines.map((t) => ({
      name:       t.name,
      percent:    t.percent,
      tax_amount: round2((item.quantity * item.unit_price) * (t.percent / 100)),
    })),
  })),
  discount_percent: input.discount_percent ?? 0,
});
// then use:
// totals.subtotal, totals.discount_amount, totals.tax_total, totals.grand_total
// totals.line_totals[idx].line_total for each item's line_total

  const po_number = await generateDocumentNumber(prisma, 'PO');

  return prisma.purchaseOrder.create({
    data: {
      po_number,
      vendor_id:        input.vendor_id,
      vendor_snapshot,
      rfp_id:           input.rfp_id ?? null,
      status:           POStatus.draft,
      is_interstate:    input.is_interstate ?? true,
      discount_percent: new Prisma.Decimal(input.discount_percent ?? 0),
      discount_amount:  new Prisma.Decimal(discount_amount),
      subtotal:         new Prisma.Decimal(subtotal),
      tax_total:        new Prisma.Decimal(tax_total),
      total:            new Prisma.Decimal(total),
      delivery_address: input.delivery_address,
      expected_delivery: input.expected_delivery,
      payment_terms:    input.payment_terms,
      notes:            input.notes,
      items: {
        create: processedItems.map((item, idx) => ({
          item_id:     item.item_id ?? null,
          description: item.description,
          hsn_sac:     item.hsn_sac ?? null,
          quantity:    new Prisma.Decimal(item.quantity),
          unit_price:  new Prisma.Decimal(item.unit_price),
          tax_lines:   item.tax_lines,
          line_total:  new Prisma.Decimal(item.line_total),
          sort_order:  item.sort_order ?? idx,
        })),
      },
    },
    include: { items: true, vendor: true },
  });
}

export async function updatePurchaseOrder(id: string, input: Partial<CreatePOInput>) {
  const existing = await prisma.purchaseOrder.findUnique({
    where: { id }, include: { items: true },
  });
  if (!existing) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  // Immutability guard — enforced here AND in middleware
  if (existing.issued_at !== null) {
    throw Object.assign(
      new Error('Purchase order is locked after issue. Use an amendment.'),
      { statusCode: 409 }
    );
  }

  const totals = calculateTotals({
  items: input.items.map((item) => ({
    quantity:   item.quantity,
    unit_price: item.unit_price,
    tax_lines:  item.tax_lines.map((t) => ({
      name:       t.name,
      percent:    t.percent,
      tax_amount: round2((item.quantity * item.unit_price) * (t.percent / 100)),
    })),
  })),
  discount_percent: input.discount_percent ?? 0,
});
// then use:
// totals.subtotal, totals.discount_amount, totals.tax_total, totals.grand_total
// totals.line_totals[idx].line_total for each item's line_total

  return prisma.$transaction(async (tx) => {
    if (input.items) {
      await tx.pOItem.deleteMany({ where: { po_id: id } });
      await tx.pOItem.createMany({
        data: processedItems.map((item, idx) => ({
          po_id:       id,
          item_id:     item.item_id ?? null,
          description: item.description,
          hsn_sac:     item.hsn_sac ?? null,
          quantity:    new Prisma.Decimal(item.quantity),
          unit_price:  new Prisma.Decimal(item.unit_price),
          tax_lines:   item.tax_lines,
          line_total:  new Prisma.Decimal(item.line_total),
          sort_order:  item.sort_order ?? idx,
        })),
      });
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        is_interstate:    input.is_interstate,
        discount_percent: input.discount_percent !== undefined
                            ? new Prisma.Decimal(input.discount_percent) : undefined,
        discount_amount:  new Prisma.Decimal(discount_amount),
        subtotal:         new Prisma.Decimal(subtotal),
        tax_total:        new Prisma.Decimal(tax_total),
        total:            new Prisma.Decimal(total),
        delivery_address: input.delivery_address,
        expected_delivery: input.expected_delivery,
        payment_terms:    input.payment_terms,
        notes:            input.notes,
      },
      include: { items: true },
    });
  });
}

export async function issuePurchaseOrder(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id }, include: { items: true },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
  if (po.issued_at !== null) {
    throw Object.assign(new Error('Purchase order is already issued'), { statusCode: 409 });
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

export async function createAmendment(id: string, input: AmendPOInput) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
  if (po.status !== POStatus.issued && po.status !== POStatus.amended) {
    throw Object.assign(
      new Error('Only ISSUED or AMENDED purchase orders can be amended'),
      { statusCode: 409 }
    );
  }

  return prisma.$transaction(async (tx) => {
    const amendment = await tx.pOAmendment.create({
      data: {
        po_id:       id,
        reason:      input.reason,
        description: input.description,
        amended_by:  input.amended_by ?? 'User',
      },
    });

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.amended },
    });

    return amendment;
  });
}

export async function getAmendments(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });

  return prisma.pOAmendment.findMany({
    where: { po_id: id },
    orderBy: { created_at: 'asc' },
  });
}

export async function cancelPurchaseOrder(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { grns: true },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
  if (po.status === POStatus.cancelled) {
    throw Object.assign(new Error('Purchase order is already cancelled'), { statusCode: 409 });
  }

  const postedGrns = po.grns.filter((g) => g.status === 'posted');
  if (postedGrns.length > 0) {
    throw Object.assign(
      new Error('Cannot cancel a PO with posted GRNs'),
      { statusCode: 409 }
    );
  }

  return prisma.purchaseOrder.update({
    where: { id },
    data: { status: POStatus.cancelled },
  });
}