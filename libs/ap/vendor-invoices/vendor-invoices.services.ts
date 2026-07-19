// ─────────────────────────────────────────────────────────────────────────────
// libs/ap/vendor-invoices/vendor-invoices.services.ts
//
// Schema facts (confirmed from schema.prisma):
//   VendorInvoice   — NO grn_id / grn relation on the header. GRN is linked
//                     at the item level via VendorInvoiceItem.po_item_id and
//                     accessed through the PO. grn_id was an assumption error.
//   VendorInvoice   — field is issue_date, not invoice_date
//   VendorInvoice   — NO payment_terms field
//   VendorInvoice   — relations: match_results (plural), dispute_records,
//                     vendor_payments (plural)
//   VendorInvoiceItem — field is quantity_billed, not quantity
//   vendor_snapshot — Prisma Json field; VendorSnapshot must have index sig
// ─────────────────────────────────────────────────────────────────────────────
import { Prisma, VendorInvoiceStatus, PaymentStatus, POStatus, GRNStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';
import { snapshotVendor } from '../../shared/utils/snapshot.utils';
import { calculateTotals, type LineItemInput } from '../../shared/engines/totals/totals-calculator';
import { calculateGST } from '../../shared/engines/gst/gst-calculator';
import { computePaymentStatusFromPayments } from '../../shared/engines/payment-status/payment-status.engine';
import type { TaxLine } from '../../shared/types/money.types';

export interface VendorInvoiceItemInput {
  po_item_id: string;
  description: string;
  hsn_sac?: string;
  quantity_billed: number;
  unit_price: number;
  tax_lines: { name: string; percent: number }[];
  sort_order?: number;
}

export interface CreateVendorInvoiceInput {
  po_id: string;
  grn_id: string;            // used only for pre-create validation, not stored on header
  vendor_ref_number?: string;
  issue_date?: Date;
  due_date?: Date;
  is_interstate?: boolean;
  discount_percent?: number;
  notes?: string;
  items: VendorInvoiceItemInput[];
}

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

function priceItems(items: VendorInvoiceItemInput[], is_interstate: boolean) {
  const pricedTaxLines: TaxLine[][] = [];
  const lineItemInputs: LineItemInput[] = items.map((item) => {
    const taxable_amount = item.quantity_billed * item.unit_price;
    const taxLines = buildPricedTaxLines(taxable_amount, item.tax_lines, is_interstate);
    pricedTaxLines.push(taxLines);
    return { quantity: item.quantity_billed, unit_price: item.unit_price, tax_lines: taxLines };
  });
  return { lineItemInputs, pricedTaxLines };
}

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
        vendor:        { select: { vendor_name: true, company_name: true } },
        po:            { select: { po_number: true } },
        match_results: { select: { status: true }, take: 1, orderBy: { matched_at: 'desc' } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vendorInvoice.count({ where }),
  ]);
  return { data: invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getVendorInvoiceById(id: string) {
  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id },
    include: {
      vendor:          true,
      po:              { include: { items: true } },
      items:           { include: { po_item: true } },
      match_results:   { orderBy: { matched_at: 'desc' }, take: 1 },
      dispute_records: true,
      vendor_payments: true,
    },
  });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  return invoice;
}

export async function createVendorInvoice(input: CreateVendorInvoiceInput) {
  if (!input.items?.length) {
    throw Object.assign(new Error('At least one line item is required'), { statusCode: 400 });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where:   { id: input.po_id },
    include: { vendor: true, items: true },
  });
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404 });
  if (po.status !== POStatus.issued) {
    throw Object.assign(
      new Error('Purchase order must be ISSUED before recording a vendor invoice'),
      { statusCode: 409 },
    );
  }

  const grn = await prisma.gRN.findUnique({ where: { id: input.grn_id } });
  if (!grn) throw Object.assign(new Error('GRN not found'), { statusCode: 404 });
  if (grn.po_id !== input.po_id) {
    throw Object.assign(new Error('GRN does not belong to this PO'), { statusCode: 409 });
  }
  if (grn.status !== GRNStatus.confirmed) {
    throw Object.assign(
      new Error('GRN must be CONFIRMED before recording a vendor invoice'),
      { statusCode: 409 },
    );
  }

  const poItemIds = new Set(po.items.map((i) => i.id));
  for (const item of input.items) {
    if (!poItemIds.has(item.po_item_id)) {
      throw Object.assign(
        new Error(`Item ${item.po_item_id} does not belong to PO ${po.po_number}`),
        { statusCode: 409 },
      );
    }
  }

  const is_interstate   = input.is_interstate ?? true;
  const vendor_snapshot = snapshotVendor(po.vendor);
  const { lineItemInputs, pricedTaxLines } = priceItems(input.items, is_interstate);
  const totals = calculateTotals({ items: lineItemInputs, discount_percent: input.discount_percent ?? 0 });
  const invoice_number = await generateDocumentNumber(prisma, 'VI');

  return prisma.vendorInvoice.create({
    data: {
      invoice_number,
      vendor_id:         po.vendor_id,
      vendor_snapshot:   vendor_snapshot as unknown as Prisma.InputJsonValue,
      po_id:             input.po_id,
      grn_id:            input.grn_id,
      vendor_ref_number: input.vendor_ref_number,
      issue_date:        input.issue_date ?? new Date(),
      due_date:          input.due_date ?? null,
      status:            VendorInvoiceStatus.draft,
      is_interstate,
      discount_percent:  new Prisma.Decimal(totals.discount_percent),
      discount_amount:   new Prisma.Decimal(totals.discount_amount),
      subtotal:          new Prisma.Decimal(totals.subtotal),
      tax_total:         new Prisma.Decimal(totals.tax_total),
      total:             new Prisma.Decimal(totals.grand_total),
      amount_paid:       new Prisma.Decimal(0),
      balance_due:       new Prisma.Decimal(totals.grand_total),
      payment_status:    PaymentStatus.unpaid,
      notes:             input.notes,
      items: {
        create: input.items.map((item, idx) => ({
          po_item_id:      item.po_item_id,
          description:     item.description,
          hsn_sac:         item.hsn_sac ?? null,
          quantity_billed: new Prisma.Decimal(item.quantity_billed),
          unit_price:      new Prisma.Decimal(item.unit_price),
          tax_lines:       pricedTaxLines[idx] as unknown as Prisma.InputJsonValue,
          line_total:      new Prisma.Decimal(totals.line_totals[idx].line_total),
          sort_order:      item.sort_order ?? idx,
        })),
      },
    },
    include: { items: true, vendor: true, po: true },
  });
}

export async function updateVendorInvoice(
  id: string,
  input: Partial<CreateVendorInvoiceInput>,
) {
  const existing = await prisma.vendorInvoice.findUnique({ where: { id }, include: { items: true } });
  if (!existing) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  if (existing.status !== VendorInvoiceStatus.draft) {
    throw Object.assign(new Error('Only DRAFT vendor invoices can be edited'), { statusCode: 409 });
  }

  return prisma.$transaction(async (tx) => {
    if (input.items) {
      const is_interstate = input.is_interstate ?? existing.is_interstate;
      const { lineItemInputs, pricedTaxLines } = priceItems(input.items, is_interstate);
      const totals = calculateTotals({
        items:            lineItemInputs,
        discount_percent: input.discount_percent ?? Number(existing.discount_percent),
      });

      await tx.vendorInvoiceItem.deleteMany({ where: { vendor_invoice_id: id } });
      await tx.vendorInvoiceItem.createMany({
        data: input.items.map((item, idx) => ({
          vendor_invoice_id: id,
          po_item_id:        item.po_item_id,
          description:       item.description,
          hsn_sac:           item.hsn_sac ?? null,
          quantity_billed:   new Prisma.Decimal(item.quantity_billed),
          unit_price:        new Prisma.Decimal(item.unit_price),
          tax_lines:         pricedTaxLines[idx] as unknown as Prisma.InputJsonValue,
          line_total:        new Prisma.Decimal(totals.line_totals[idx].line_total),
          sort_order:        item.sort_order ?? idx,
        })),
      });

      return tx.vendorInvoice.update({
        where: { id },
        data: {
          is_interstate:    input.is_interstate,
          discount_percent: new Prisma.Decimal(totals.discount_percent),
          discount_amount:  new Prisma.Decimal(totals.discount_amount),
          subtotal:         new Prisma.Decimal(totals.subtotal),
          tax_total:        new Prisma.Decimal(totals.tax_total),
          total:            new Prisma.Decimal(totals.grand_total),
          balance_due:      new Prisma.Decimal(totals.grand_total),
          notes:            input.notes,
          due_date:         input.due_date ?? null,
        },
        include: { items: true },
      });
    }

    return tx.vendorInvoice.update({
      where: { id },
      data: { notes: input.notes, due_date: input.due_date ?? null, is_interstate: input.is_interstate },
      include: { items: true },
    });
  });
}

export async function submitVendorInvoice(id: string) {
  const invoice = await prisma.vendorInvoice.findUnique({ where: { id } });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  if (invoice.status !== VendorInvoiceStatus.draft) {
    throw Object.assign(new Error('Only DRAFT vendor invoices can be submitted'), { statusCode: 409 });
  }
  return prisma.vendorInvoice.update({
    where: { id },
    data:  { status: VendorInvoiceStatus.submitted },
    include: { items: true },
  });
}

export async function approveVendorInvoice(id: string, approved_by?: string) {
  const invoice = await prisma.vendorInvoice.findUnique({ where: { id } });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  if (invoice.status !== VendorInvoiceStatus.matched) {
    throw Object.assign(
      new Error('Only MATCHED vendor invoices can be approved for payment'),
      { statusCode: 409 },
    );
  }
  return prisma.vendorInvoice.update({
    where: { id },
    data:  { status: VendorInvoiceStatus.approved, approved_by: approved_by ?? 'Finance', approved_at: new Date() },
    include: { items: true },
  });
}

export async function cancelVendorInvoice(id: string) {
  const invoice = await prisma.vendorInvoice.findUnique({ where: { id } });
  if (!invoice) throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  if (([VendorInvoiceStatus.paid, VendorInvoiceStatus.void] as VendorInvoiceStatus[]).includes(invoice.status)) {
    throw Object.assign(new Error(`Cannot void a ${invoice.status} vendor invoice`), { statusCode: 409 });
  }
  return prisma.vendorInvoice.update({ where: { id }, data: { status: VendorInvoiceStatus.void } });
}

export async function syncVendorInvoicePaymentFields(
  invoice_id: string,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const [payments, invoice] = await Promise.all([
    client.vendorPayment.findMany({ where: { vendor_invoice_id: invoice_id } }),
    client.vendorInvoice.findUnique({ where: { id: invoice_id }, select: { total: true } }),
  ]);
  if (!invoice) return null;

  const { amount_paid, balance_due, payment_status } = computePaymentStatusFromPayments(
    Number(invoice.total),
    payments.map((p) => Number(p.amount)),
  );

  return client.vendorInvoice.update({
    where: { id: invoice_id },
    data: {
      amount_paid:    new Prisma.Decimal(amount_paid),
      balance_due:    new Prisma.Decimal(balance_due),
      payment_status,
      ...(payment_status === 'paid' && { status: VendorInvoiceStatus.paid }),
    },
  });
}