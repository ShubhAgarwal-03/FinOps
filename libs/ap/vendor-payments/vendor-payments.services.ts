import { Prisma, PaymentMethod, VendorInvoiceStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { generateDocumentNumber } from '../../shared/utils/sequential-numbering';
import { syncVendorInvoicePaymentFields } from '../vendor-invoices/vendor-invoices.services';

export interface CreateVendorPaymentInput {
  vendor_invoice_id: string;
  amount: number;
  method: string;
  paid_at?: Date;
  notes?: string;
  payment_ref?: string;
}

const VALID_METHODS: PaymentMethod[] = [
  'cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other',
];

// ── List ──────────────────────────────────────────────────

export async function listVendorPayments(query: {
  vendor_id?: string; vendor_invoice_id?: string;
  page?: string; limit?: string;
}) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(50, parseInt(query.limit ?? '20', 10));

  const where: Prisma.VendorPaymentWhereInput = {
    ...(query.vendor_id         && { vendor_id:         query.vendor_id }),
    ...(query.vendor_invoice_id && { vendor_invoice_id: query.vendor_invoice_id }),
  };

  const [payments, total] = await prisma.$transaction([
    prisma.vendorPayment.findMany({
      where,
      include: {
        vendor:         { select: { vendor_name: true } },
        vendor_invoice: { select: { invoice_number: true } },
      },
      orderBy: { paid_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.vendorPayment.count({ where }),
  ]);

  return { payments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ── Create (gated by match + finance approval) ────────────

export async function createVendorPayment(input: CreateVendorPaymentInput) {
  const invoice = await prisma.vendorInvoice.findUnique({
    where: { id: input.vendor_invoice_id },
    include: { match_result: true },
  });
  if (!invoice) {
    throw Object.assign(new Error('Vendor invoice not found'), { statusCode: 404 });
  }

  // ── GATE 1: must be finance-approved ─────────────────────
  if (invoice.status !== VendorInvoiceStatus.approved &&
      invoice.status !== VendorInvoiceStatus.partial) {
    throw Object.assign(
      new Error(
        `Payment blocked: invoice status is "${invoice.status}". ` +
        `Invoice must be APPROVED by finance before payment can be recorded.`
      ),
      { statusCode: 409, code: 'PAYMENT_BLOCKED' }
    );
  }

  // ── GATE 2: match must exist and be MATCHED ───────────────
  if (!invoice.match_result || !invoice.match_result.overall_matched) {
    throw Object.assign(
      new Error(
        'Payment blocked: 3-way match has not passed. ' +
        'Resolve all discrepancies before recording payment.'
      ),
      { statusCode: 409, code: 'MATCH_REQUIRED' }
    );
  }

  // ── Validate amount ───────────────────────────────────────
  if (!input.amount || input.amount <= 0) {
    throw Object.assign(new Error('Amount must be greater than 0'), { statusCode: 400 });
  }
  if (!VALID_METHODS.includes(input.method as PaymentMethod)) {
    throw Object.assign(new Error('Invalid payment method'), { statusCode: 400 });
  }
  const balance_due = Number(invoice.balance_due);
  if (input.amount > balance_due + 0.001) {
    throw Object.assign(
      new Error(`Overpayment blocked: balance due is ${balance_due.toFixed(2)}`),
      { statusCode: 409, code: 'OVERPAYMENT' }
    );
  }

  const payment_ref = input.payment_ref ?? await generateDocumentNumber(prisma, 'PAY');

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.vendorPayment.create({
      data: {
        vendor_invoice_id: input.vendor_invoice_id,
        vendor_id:         invoice.vendor_id,
        payment_ref,
        amount:    new Prisma.Decimal(parseFloat(input.amount.toFixed(2))),
        method:    input.method as PaymentMethod,
        paid_at:   input.paid_at ?? new Date(),
        notes:     input.notes?.trim() ?? null,
      },
    });

    // Vendor ledger entry — CREDIT (money going out)
    await tx.vendorLedger.create({
      data: {
        vendor_id:         invoice.vendor_id,
        vendor_invoice_id: input.vendor_invoice_id,
        entry_type:        'PAYMENT_MADE',
        direction:         'CREDIT',
        amount:            new Prisma.Decimal(input.amount),
        description:       `Payment ${payment_ref}${input.notes ? ` — ${input.notes}` : ''}`,
        reference_number:  payment_ref,
        entry_date:        payment.paid_at,
      },
    });

    // Sync invoice payment fields
    const updatedInvoice = await syncVendorInvoicePaymentFields(
      input.vendor_invoice_id,
      tx
    );

    return { payment, invoice: updatedInvoice };
  });

  return result;
}