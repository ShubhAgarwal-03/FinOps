import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';

const VALID_METHODS: PaymentMethod[] = [
  'cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other',
];

export async function getPaymentsByInvoice(invoice_id: string) {
  return prisma.salesPayment.findMany({
    where: { invoice_id },
    orderBy: { paid_at: 'desc' },
  });
}

/**
 * Re-aggregates all payments for an invoice and writes
 * amount_paid, balance_due, payment_status back atomically.
 * Called after every payment create/delete.
 */
export async function syncInvoicePaymentFields(
  invoice_id: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;

  const payments = await client.salesPayment.findMany({ where: { invoice_id } });
  const amount_paid = parseFloat(
    payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)
  );

  const invoice = await client.salesInvoice.findUnique({
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

  return client.salesInvoice.update({
    where: { id: invoice_id },
    data: {
      amount_paid:    new Prisma.Decimal(amount_paid),
      balance_due:    new Prisma.Decimal(balance_due),
      payment_status,
    },
  });
}

export async function recordPayment(
  invoice_id: string,
  input: { amount: number; method: string; paid_at?: Date; notes?: string }
) {
  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: invoice_id, is_deleted: false },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });

  if (!input.amount || input.amount <= 0) {
    throw Object.assign(new Error('Amount must be greater than 0'), { statusCode: 400 });
  }
  if (!VALID_METHODS.includes(input.method as PaymentMethod)) {
    throw Object.assign(new Error('Invalid payment method'), { statusCode: 400 });
  }

  const balance_due = Number(invoice.balance_due);
  if (input.amount > balance_due + 0.001) {
    throw Object.assign(
      new Error(`Amount exceeds balance due (${balance_due.toFixed(2)})`),
      { statusCode: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.salesPayment.create({
      data: {
        invoice_id,
        amount:  new Prisma.Decimal(parseFloat(input.amount.toFixed(2))),
        method:  input.method as PaymentMethod,
        paid_at: input.paid_at ?? new Date(),
        notes:   input.notes?.trim() ?? null,
      },
    });

    // Ledger entry — CREDIT customer (money received)
    await tx.customerLedger.create({
      data: {
        customer_id:      invoice.customer_id,
        sales_invoice_id: invoice_id,
        entry_type:       'PAYMENT_RECEIVED',
        direction:        'CREDIT',
        amount:           new Prisma.Decimal(input.amount),
        description:      `Payment${input.notes ? ` — ${input.notes}` : ''} (${invoice.invoice_number})`,
        reference_number: invoice.invoice_number,
        entry_date:       payment.paid_at,
      },
    });

    const updatedInvoice = await syncInvoicePaymentFields(invoice_id, tx);
    return { payment, invoice: updatedInvoice };
  });

  return result;
}