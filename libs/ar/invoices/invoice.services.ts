import { Prisma, SalesInvoiceStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { calculateTotals } from '../../shared/engines/totals/totals-calculator';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';
import { snapshotCustomer } from '../../shared/utils/snapshot.utils';

// ── Types ─────────────────────────────────────────────────

export interface InvoiceLineItemInput {
  item_id?: string;
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  tax_lines: { name: string; percent: number }[];
  sort_order?: number;
}

export interface CreateInvoiceInput {
  customer_id: string;
  po_so_number?: string;
  issue_date?: Date;
  due_date?: Date;
  items: InvoiceLineItemInput[];
  is_interstate?: boolean;
  discount_percent?: number;
  tax_exempt?: boolean;
  shipping_address?: string;
  payment_terms?: string;
  notes?: string;
  terms_and_conditions?: string;
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  status?: SalesInvoiceStatus;
}

export interface InvoiceListFilters {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Helpers ───────────────────────────────────────────────

function buildWhereClause(filters: InvoiceListFilters): Prisma.SalesInvoiceWhereInput {
  const where: Prisma.SalesInvoiceWhereInput = { is_deleted: false };

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'partially_paid') {
      where.payment_status = PaymentStatus.partial;
    } else if (['draft', 'sent', 'paid', 'void'].includes(filters.status)) {
      where.status = filters.status as SalesInvoiceStatus;
    }
  }

  if (filters.from || filters.to) {
    where.issue_date = {};
    if (filters.from) where.issue_date.gte = new Date(filters.from);
    if (filters.to)   where.issue_date.lte = new Date(filters.to);
  }

  if (filters.search) {
    where.OR = [
      { invoice_number: { contains: filters.search, mode: 'insensitive' } },
      {
        customer_snapshot: {
          path: ['customer_name'],
          string_contains: filters.search,
        },
      },
      {
        customer_snapshot: {
          path: ['company_name'],
          string_contains: filters.search,
        },
      },
    ];
  }

  return where;
}

// ── Service functions ─────────────────────────────────────

export async function listInvoices(filters: InvoiceListFilters) {
  const page  = Math.max(1, filters.page  ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const skip  = (page - 1) * limit;

  const where = buildWhereClause(filters);

  const [invoices, total] = await prisma.$transaction([
    prisma.salesInvoice.findMany({
      where,
      include: { items: true },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.salesInvoice.count({ where }),
  ]);

  return {
    invoices,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function getInvoiceById(id: string) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, is_deleted: false },
    include: { items: true, payments: true },
  });
  return invoice;
}

export async function createInvoice(input: CreateInvoiceInput) {
  // 1. Validate due date
  if (input.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (input.due_date < today) {
      throw Object.assign(new Error('Due date cannot be in the past'), { statusCode: 400 });
    }
  }

  // 2. Fetch and snapshot customer
  const customer = await prisma.customer.findFirst({
    where: { id: input.customer_id, is_deleted: false },
  });
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  }
  const customer_snapshot = snapshotCustomer(customer);

  // 3. Calculate totals using shared engine
  const { processedItems, subtotal, discount_amount, tax_total, total } =
    calculateTotals(input.items, input.discount_percent ?? 0);

  // 4. Sequential invoice number
  const invoice_number = await generateDocumentNumber(prisma, 'INV');

  // 5. Create in transaction (invoice + ledger entry)
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.salesInvoice.create({
      data: {
        invoice_number,
        po_so_number:         input.po_so_number,
        customer_id:          input.customer_id,
        customer_snapshot,
        issue_date:           input.issue_date ?? new Date(),
        due_date:             input.due_date ?? null,
        is_interstate:        input.is_interstate ?? true,
        tax_exempt:           input.tax_exempt ?? false,
        shipping_address:     input.shipping_address,
        discount_percent:     new Prisma.Decimal(input.discount_percent ?? 0),
        discount_amount:      new Prisma.Decimal(discount_amount),
        subtotal:             new Prisma.Decimal(subtotal),
        tax_total:            new Prisma.Decimal(tax_total),
        total:                new Prisma.Decimal(total),
        amount_paid:          new Prisma.Decimal(0),
        balance_due:          new Prisma.Decimal(total),
        payment_status:       PaymentStatus.unpaid,
        status:               SalesInvoiceStatus.draft,
        payment_terms:        input.payment_terms,
        notes:                input.notes,
        terms_and_conditions: input.terms_and_conditions,
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
      include: { items: true },
    });

    // Ledger entry — DEBIT customer (money owed to us)
    await tx.customerLedger.create({
      data: {
        customer_id:      input.customer_id,
        sales_invoice_id: inv.id,
        entry_type:       'INVOICE_RAISED',
        direction:        'DEBIT',
        amount:           new Prisma.Decimal(total),
        description:      `Invoice ${invoice_number}`,
        reference_number: invoice_number,
        entry_date:       inv.issue_date,
      },
    });

    return inv;
  });

  return invoice;
}

export async function updateInvoice(id: string, input: UpdateInvoiceInput) {
  const existing = await prisma.salesInvoice.findFirst({
    where: { id, is_deleted: false },
    include: { payments: true },
  });
  if (!existing) {
    throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
  }

  if (input.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (input.due_date < today) {
      throw Object.assign(new Error('Due date cannot be in the past'), { statusCode: 400 });
    }
  }

  // Re-snapshot customer if customer_id provided
  let customer_snapshot = existing.customer_snapshot;
  if (input.customer_id) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customer_id, is_deleted: false },
    });
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
    customer_snapshot = buildCustomerSnapshot(customer);
  }

  // Recalculate totals only if items provided
  let totalsUpdate: Partial<{
    subtotal: Prisma.Decimal;
    discount_amount: Prisma.Decimal;
    tax_total: Prisma.Decimal;
    total: Prisma.Decimal;
    amount_paid: Prisma.Decimal;
    balance_due: Prisma.Decimal;
    payment_status: PaymentStatus;
  }> = {};

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

    const amount_paid = existing.payments.reduce(
      (sum, p) => sum + Number(p.amount), 0
    );
    const balance_due = parseFloat((total - amount_paid).toFixed(2));
    const payment_status: PaymentStatus =
      amount_paid <= 0     ? PaymentStatus.unpaid
      : balance_due <= 0   ? PaymentStatus.paid
      :                      PaymentStatus.partial;

    totalsUpdate = {
      subtotal:       new Prisma.Decimal(subtotal),
      discount_amount: new Prisma.Decimal(discount_amount),
      tax_total:      new Prisma.Decimal(tax_total),
      total:          new Prisma.Decimal(total),
      amount_paid:    new Prisma.Decimal(amount_paid),
      balance_due:    new Prisma.Decimal(balance_due),
      payment_status,
    };
  }

  const invoice = await prisma.$transaction(async (tx) => {
    // Replace line items if provided
    if (input.items) {
      await tx.salesInvoiceItem.deleteMany({ where: { invoice_id: id } });
      const { processedItems } = calculateTotals(input.items, input.discount_percent ?? 0);
      await tx.salesInvoiceItem.createMany({
        data: processedItems.map((item, idx) => ({
          invoice_id:  id,
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

    return tx.salesInvoice.update({
      where: { id },
      data: {
        customer_id:          input.customer_id ?? existing.customer_id,
        customer_snapshot,
        po_so_number:         input.po_so_number,
        due_date:             input.due_date ?? null,
        is_interstate:        input.is_interstate ?? existing.is_interstate,
        tax_exempt:           input.tax_exempt ?? existing.tax_exempt,
        shipping_address:     input.shipping_address,
        discount_percent:     input.discount_percent !== undefined
                                ? new Prisma.Decimal(input.discount_percent)
                                : existing.discount_percent,
        payment_terms:        input.payment_terms,
        notes:                input.notes,
        terms_and_conditions: input.terms_and_conditions,
        status:               input.status ?? existing.status,
        ...totalsUpdate,
      },
      include: { items: true },
    });
  });

  return invoice;
}

export async function duplicateInvoice(id: string) {
  const source = await prisma.salesInvoice.findFirst({
    where: { id, is_deleted: false },
    include: { items: true },
  });
  if (!source) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
const invoice_number = await generateDocumentNumber(prisma, 'INV');

  return prisma.salesInvoice.create({
    data: {
      invoice_number,
      customer_id:       source.customer_id,
      customer_snapshot: source.customer_snapshot,
      status:            SalesInvoiceStatus.draft,
      issue_date:        new Date(),
      is_interstate:     source.is_interstate,
      subtotal:          source.subtotal,
      discount_percent:  source.discount_percent,
      discount_amount:   source.discount_amount,
      tax_total:         source.tax_total,
      total:             source.total,
      amount_paid:       new Prisma.Decimal(0),
      balance_due:       source.total,
      payment_status:    PaymentStatus.unpaid,
      notes:             source.notes,
      items: {
        create: source.items.map((item) => ({
          item_id:     item.item_id,
          description: item.description,
          hsn_sac:     item.hsn_sac,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
          tax_lines:   item.tax_lines,
          line_total:  item.line_total,
          sort_order:  item.sort_order,
        })),
      },
    },
    include: { items: true },
  });
}

export async function softDeleteInvoice(id: string) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, is_deleted: false },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });

  return prisma.salesInvoice.update({
    where: { id },
    data: { is_deleted: true, deleted_at: new Date() },
  });
}

export async function updateInvoiceStatus(id: string, status: SalesInvoiceStatus) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id, is_deleted: false },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });

  // Mark as Paid shortcut — auto-create full payment for remaining balance
  if (status === SalesInvoiceStatus.paid && invoice.payment_status !== PaymentStatus.paid) {
    const remaining = parseFloat(
      (Number(invoice.total) - Number(invoice.amount_paid)).toFixed(2)
    );
    if (remaining > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.salesPayment.create({
          data: {
            invoice_id: id,
            amount:     new Prisma.Decimal(remaining),
            method:     'other',
            paid_at:    new Date(),
            notes:      'Recorded via Mark as Paid',
          },
        });
        await tx.customerLedger.create({
          data: {
            customer_id:      invoice.customer_id,
            sales_invoice_id: id,
            entry_type:       'PAYMENT_RECEIVED',
            direction:        'CREDIT',
            amount:           new Prisma.Decimal(remaining),
            description:      `Payment (Mark as Paid) — ${invoice.invoice_number}`,
            reference_number: invoice.invoice_number,
            entry_date:       new Date(),
          },
        });
        await tx.salesInvoice.update({
          where: { id },
          data: {
            amount_paid:    invoice.total,
            balance_due:    new Prisma.Decimal(0),
            payment_status: PaymentStatus.paid,
            status:         SalesInvoiceStatus.paid,
          },
        });
      });
      return prisma.salesInvoice.findUnique({ where: { id }, include: { items: true } });
    }
  }

  return prisma.salesInvoice.update({
    where: { id },
    data: { status },
    include: { items: true },
  });
}