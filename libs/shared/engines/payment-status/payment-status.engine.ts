import { round2 } from '../../utils/round.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

export interface PaymentStatusInput {
  /** The document's grand total (invoice total, PO value, etc.) */
  document_total: number;
  /** Sum of all payments recorded against this document */
  amount_paid: number;
}

export interface PaymentStatusResult {
  amount_paid: number;
  balance_due: number;
  payment_status: PaymentStatus;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Computes the payment status of any payable document.
 *
 * Replaces the inline status logic in:
 *   - routes/payments.ts → syncInvoicePaymentFields()
 *   - routes/invoices.ts → PUT handler
 *
 * Status rules:
 *   amount_paid <= 0               → 'unpaid'
 *   0 < amount_paid < total        → 'partial'
 *   amount_paid === total          → 'paid'
 *   amount_paid > total            → 'overpaid'  (guarded at API level but tracked here)
 *
 * The existing system does not expose 'overpaid' to the UI but the engine
 * tracks it so the AP payment gate can detect and block erroneous over-payment.
 */
export function computePaymentStatus(
  input: PaymentStatusInput,
): PaymentStatusResult {
  const { document_total, amount_paid } = input;

  const paid   = round2(Math.max(0, amount_paid));
  const total  = round2(document_total);
  const balance = round2(total - paid);

  let payment_status: PaymentStatus;

  if (paid <= 0) {
    payment_status = 'unpaid';
  } else if (balance < 0) {
    payment_status = 'overpaid';
  } else if (balance === 0) {
    payment_status = 'paid';
  } else {
    payment_status = 'partial';
  }

  return {
    amount_paid: paid,
    balance_due: Math.max(0, balance),
    payment_status,
  };
}

/**
 * Computes payment status from a raw array of payment amounts.
 * Convenience wrapper for use in Prisma-based route handlers.
 *
 * @example
 *   computePaymentStatusFromPayments(5000, [1000, 2000])
 *   // → { amount_paid: 3000, balance_due: 2000, payment_status: 'partial' }
 */
export function computePaymentStatusFromPayments(
  document_total: number,
  payment_amounts: number[],
): PaymentStatusResult {
  const amount_paid = round2(
    payment_amounts.reduce((sum, p) => sum + (Number(p) || 0), 0),
  );
  return computePaymentStatus({ document_total, amount_paid });
}
