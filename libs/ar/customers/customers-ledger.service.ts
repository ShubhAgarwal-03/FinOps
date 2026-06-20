import { prisma } from '../../../apps/api/src/config/prisma';

export async function getCustomerLedger(customer_id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customer_id, is_deleted: false },
  });
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  // Pull ledger entries ordered chronologically
  const entries = await prisma.customerLedger.findMany({
    where: { customer_id },
    orderBy: [{ entry_date: 'asc' }, { created_at: 'asc' }],
    include: { sales_invoice: { select: { invoice_number: true } } },
  });

  let balance = 0;
  const rows = entries.map((entry) => {
    const debit  = entry.direction === 'DEBIT'  ? Number(entry.amount) : 0;
    const credit = entry.direction === 'CREDIT' ? Number(entry.amount) : 0;
    balance = parseFloat((balance + debit - credit).toFixed(2));
    return {
      id:               entry.id,
      date:             entry.entry_date,
      description:      entry.description,
      invoice_number:   entry.sales_invoice?.invoice_number ?? entry.reference_number,
      type:             entry.entry_type,
      debit,
      credit,
      balance,
    };
  });

  const total_invoiced = rows
    .filter((r) => r.type === 'INVOICE_RAISED')
    .reduce((s, r) => s + r.debit, 0);

  const total_paid = rows
    .filter((r) => r.type === 'PAYMENT_RECEIVED')
    .reduce((s, r) => s + r.credit, 0);

  return {
    customer,
    rows,
    summary: {
      total_invoiced:  parseFloat(total_invoiced.toFixed(2)),
      total_paid:      parseFloat(total_paid.toFixed(2)),
      closing_balance: balance,
      currency:        customer.currency,
      country:         customer.country,
    },
  };
}