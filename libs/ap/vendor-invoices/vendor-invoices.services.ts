import { Prisma, VendorInvoiceStatus, PaymentStatus, POStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';
import { snapshotVendor } from '../../shared/utils/snapshot.utils';
import { calculateTotalsForService } from '../../shared/engines/totals/totals-calculator';

export interface VendorInvoiceItemInput {
  po_item_id: string;       // must link to a PO item — no free-form items
  description: string;
  hsn_sac?: string;
  quantity: number;         // what vendor billed — compared against PO + GRN
  unit_price: number;
  tax_lines: { name: string; percent: number }[];
  sort_order?: number;
}

export interface CreateVendorInvoiceInput {
  po_id: string;
  grn_id: string;
  vendor_ref_number?: string;   // vendor's own invoice number
  invoice_date?: Date;
  due_date?: Date;
  is_interstate?: boolean;
  discount_percent?: number;
  notes?: string;
  payment_terms?: string;
  items: VendorInvoiceItemInput[];
}

// ── List ──────────────────────────────────────────────────

export async function listVendorInvoices(query: {
  status?: string; vendor_id?: string; po_id?: string;
  page?: string; limit?: string;
}) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.VendorInvoiceWhereInput = {
    ...(query.status    && { status:    query.status as VendorInvoiceStatus }),
    ...(query.vendor_id && { vendor_id: query.vendor_id }),
    ...(query.po_id     && { po_id:     query.po_id }),
  };

  const [invoices, total] = await prisma.$transaction([
    prisma.vendorInvoice.findMany({
      where,
      include: {
        vendor: { select: { vendor_name: true, company_name: true } },
        po:     { select: { po_number: true } },
        grn:    { select: { grn_number: true } },
        match_result: { select: { status: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vendorInvoice.count({ where }),
  ]);

  return { invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ── Get one ───────────────────────────────────────────────

export async function getVendorInvoiceById(id: string) {
  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id },
    include: {
      vendor:       true,
      po:           { include: { items: true } },
      grn:          { include: { items: true } },
      items:        { include: { po_item: true } },
      match_result: { include: { item_results: true } },
      disputes:     true,
      payments:     true,
    },
  });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  return invoice;
}

// ── Create ────────────────────────────────────────────────

export async function createVendorInvoice(input: CreateVendorInvoiceInput) {
  if (!input.items?.length) {
    throw Object.assign(new Error('At least one line item is required'), { statusCode: 400 });
  }

  // PO must be ISSUED or AMENDED
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: input.po_id },
    include: { vendor: true, items: true },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
  if (po.status !== POStatus.issued && po.status !== POStatus.amended) {
    throw Object.assign(
      new Error('Purchase order must be ISSUED before recording a vendor invoice'),
      { statusCode: 409 }
    );
  }

  // GRN must be POSTED and belong to same PO
  const grn = await prisma.gRN.findUnique({
    where: { id: input.grn_id },
    include: { items: true },
  });
  if (!grn) throw Object.assign(new Error('GRN not found'), { statusCode: 404 });
  if (grn.po_id !== input.po_id) {
    throw Object.assign(new Error('GRN does not belong to this PO'), { statusCode: 409 });
  }
  if (grn.status !== 'posted') {
    throw Object.assign(new Error('GRN must be POSTED before recording a vendor invoice'), { statusCode: 409 });
  }

  // Validate all invoice items reference valid PO items
  const poItemIds = new Set(po.items.map((i) => i.id));
  for (const item of input.items) {
    if (!poItemIds.has(item.po_item_id)) {
      throw Object.assign(
        new Error(`Item ${item.po_item_id} does not belong to PO ${po.po_number}`),
        { statusCode: 409 }
      );
    }
  }

  const vendor_snapshot = snapshotVendor(po.vendor);
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

  const invoice_number = await generateDocumentNumber(prisma, 'VI');

  return prisma.vendorInvoice.create({
    data: {
      invoice_number,
      vendor_id:         po.vendor_id,
      vendor_snapshot,
      po_id:             input.po_id,
      grn_id:            input.grn_id,
      vendor_ref_number: input.vendor_ref_number,
      invoice_date:      input.invoice_date ?? new Date(),
      due_date:          input.due_date ?? null,
      status:            VendorInvoiceStatus.draft,
      is_interstate:     input.is_interstate ?? true,
      discount_percent:  new Prisma.Decimal(input.discount_percent ?? 0),
      discount_amount:   new Prisma.Decimal(discount_amount),
      subtotal:          new Prisma.Decimal(subtotal),
      tax_total:         new Prisma.Decimal(tax_total),
      total:             new Prisma.Decimal(total),
      amount_paid:       new Prisma.Decimal(0),
      balance_due:       new Prisma.Decimal(total),
      payment_status:    PaymentStatus.unpaid,
      notes:             input.notes,
      payment_terms:     input.payment_terms,
      items: {
        create: processedItems.map((item, idx) => ({
          po_item_id:  item.po_item_id,
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
    include: { items: true, vendor: true, po: true, grn: true },
  });
}

// ── Update (DRAFT only) ───────────────────────────────────

export async function updateVendorInvoice(
  id: string,
  input: Partial<CreateVendorInvoiceInput>
) {
  const existing = await prisma.vendorInvoice.findUnique({
    where: { id }, include: { items: true },
  });
  if (!existing) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  if (existing.status !== VendorInvoiceStatus.draft) {
    throw Object.assign(
      new Error('Only DRAFT vendor invoices can be edited'),
      { statusCode: 409 }
    );
  }

  return prisma.$transaction(async (tx) => {
    if (input.items) {
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

      await tx.vendorInvoiceItem.deleteMany({ where: { vendor_invoice_id: id } });
      await tx.vendorInvoiceItem.createMany({
        data: processedItems.map((item, idx) => ({
          vendor_invoice_id: id,
          po_item_id:        item.po_item_id,
          description:       item.description,
          hsn_sac:           item.hsn_sac ?? null,
          quantity:          new Prisma.Decimal(item.quantity),
          unit_price:        new Prisma.Decimal(item.unit_price),
          tax_lines:         item.tax_lines,
          line_total:        new Prisma.Decimal(item.line_total),
          sort_order:        item.sort_order ?? idx,
        })),
      });

      return tx.vendorInvoice.update({
        where: { id },
        data: {
          discount_percent: new Prisma.Decimal(input.discount_percent ?? 0),
          discount_amount:  new Prisma.Decimal(discount_amount),
          subtotal:         new Prisma.Decimal(subtotal),
          tax_total:        new Prisma.Decimal(tax_total),
          total:            new Prisma.Decimal(total),
          balance_due:      new Prisma.Decimal(total),
          notes:            input.notes,
          payment_terms:    input.payment_terms,
          due_date:         input.due_date ?? null,
          is_interstate:    input.is_interstate,
        },
        include: { items: true },
      });
    }

    return tx.vendorInvoice.update({
      where: { id },
      data: {
        notes:         input.notes,
        payment_terms: input.payment_terms,
        due_date:      input.due_date ?? null,
        is_interstate: input.is_interstate,
      },
      include: { items: true },
    });
  });
}

// ── Submit (DRAFT → SUBMITTED, triggers match) ────────────

export async function submitVendorInvoice(id: string) {
  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id }, include: { grn: true },
  });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  if (invoice.status !== VendorInvoiceStatus.draft) {
    throw Object.assign(
      new Error('Only DRAFT vendor invoices can be submitted'),
      { statusCode: 409 }
    );
  }
  if (!invoice.grn_id) {
    throw Object.assign(
      new Error('GRN must be linked before submitting'),
      { statusCode: 409 }
    );
  }

  return prisma.vendorInvoice.update({
    where: { id },
    data: { status: VendorInvoiceStatus.submitted },
    include: { items: true },
  });
}

// ── Finance approve (MATCHED → APPROVED) ─────────────────

export async function approveVendorInvoice(id: string, approved_by?: string) {
  const invoice = await prisma.vendorInvoice.findUnique({ where: { id } });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });

  if (invoice.status !== VendorInvoiceStatus.matched) {
    throw Object.assign(
      new Error('Only MATCHED vendor invoices can be approved for payment'),
      { statusCode: 409 }
    );
  }

  return prisma.vendorInvoice.update({
    where: { id },
    data: {
      status:      VendorInvoiceStatus.approved,
      approved_by: approved_by ?? 'Finance',
      approved_at: new Date(),
    },
    include: { items: true },
  });
}

// ── Cancel ────────────────────────────────────────────────

export async function cancelVendorInvoice(id: string) {
  const invoice = await prisma.vendorInvoice.findUnique({ where: { id } });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });

  const nonCancellable: VendorInvoiceStatus[] = [
    VendorInvoiceStatus.paid,
    VendorInvoiceStatus.cancelled,
  ];
  if (nonCancellable.includes(invoice.status)) {
    throw Object.assign(
      new Error(`Cannot cancel a ${invoice.status} vendor invoice`),
      { statusCode: 409 }
    );
  }

  return prisma.vendorInvoice.update({
    where: { id },
    data: { status: VendorInvoiceStatus.cancelled },
  });
}

// ── Sync payment fields (called by vendor-payment service) ─

export async function syncVendorInvoicePaymentFields(
  invoice_id: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;

  const payments = await client.vendorPayment.findMany({ where: { vendor_invoice_id: invoice_id } });
  const amount_paid = parseFloat(
    payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)
  );

  const invoice = await client.vendorInvoice.findUnique({
    where: { id: invoice_id },
    select: { total: true },
  });
  if (!invoice) return null;

  const total      = Number(invoice.total);
  const balance_due = parseFloat((total - amount_paid).toFixed(2));
  const payment_status: PaymentStatus =
    amount_paid <= 0   ? PaymentStatus.unpaid
    : balance_due <= 0 ? PaymentStatus.paid
    :                    PaymentStatus.partial;

  return client.vendorInvoice.update({
    where: { id: invoice_id },
    data: {
      amount_paid:    new Prisma.Decimal(amount_paid),
      balance_due:    new Prisma.Decimal(balance_due),
      payment_status,
      ...(payment_status === PaymentStatus.paid && {
        status: VendorInvoiceStatus.paid,
      }),
    },
  });
}