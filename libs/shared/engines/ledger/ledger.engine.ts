import { round2 } from '../../utils/round.utils';
import type { LedgerEntry, LedgerSummary, EntryType, LedgerDirection } from '../../types/ledger.types';

// ─── Raw event (DB row) ───────────────────────────────────────────────────────

/**
 * Raw input rows fed to the ledger engine.
 * In Prisma these map to `customer_ledger` / `vendor_ledger` table rows.
 */
export interface LedgerRawEvent {
  date: string;
  description: string;
  reference_number?: string;
  reference_id?: string;
  entry_type: EntryType;
  direction: LedgerDirection;
  amount: number;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Computes running balances for a chronological sequence of ledger events.
 *
 * Convention (AR — customer ledger):
 *   DEBIT  = customer owes us more  (+balance)
 *   CREDIT = customer paid us       (-balance)
 *   Positive closing balance = outstanding receivable
 *
 * Convention (AP — vendor ledger):
 *   CREDIT = we owe vendor more     (+balance)
 *   DEBIT  = we paid vendor         (-balance)
 *   Positive closing balance = outstanding payable
 *
 * The direction convention is kept symmetric so the same engine works for both.
 * The UI layer decides which label to display ("Amount Owed" vs "Amount Payable").
 *
 * Running balance formula:
 *   balance += amount  if DEBIT
 *   balance -= amount  if CREDIT
 */
export function computeLedger(events: LedgerRawEvent[]): LedgerEntry[] {
  let running_balance = 0;

  return events
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((event): LedgerEntry => {
      if (event.direction === 'DEBIT') {
        running_balance = round2(running_balance + event.amount);
      } else {
        running_balance = round2(running_balance - event.amount);
      }

      return {
        date: event.date,
        description: event.description,
        reference_number: event.reference_number,
        reference_id: event.reference_id,
        entry_type: event.entry_type,
        direction: event.direction,
        amount: round2(event.amount),
        running_balance,
      };
    });
}

/**
 * Builds a LedgerSummary from a set of raw events.
 * Separates invoiced amounts (DEBITs for AR, CREDITs for AP) from
 * payment amounts (CREDITs for AR, DEBITs for AP).
 *
 * For AR:
 *   total_invoiced = sum of DEBIT events (invoices raised)
 *   total_paid     = sum of CREDIT events (payments received)
 *
 * For AP (caller should pass events with directions already normalised):
 *   total_invoiced = sum of CREDIT events (vendor invoices received)
 *   total_paid     = sum of DEBIT events (vendor payments made)
 */
export function computeLedgerSummary(
  events: LedgerRawEvent[],
  currency: string,
  invoiceDirection: LedgerDirection = 'DEBIT',
): LedgerSummary {
  const paymentDirection: LedgerDirection =
    invoiceDirection === 'DEBIT' ? 'CREDIT' : 'DEBIT';

  let total_invoiced = 0;
  let total_paid = 0;

  for (const e of events) {
    if (e.direction === invoiceDirection) {
      total_invoiced = round2(total_invoiced + e.amount);
    } else if (e.direction === paymentDirection) {
      total_paid = round2(total_paid + e.amount);
    }
  }

  return {
    total_invoiced,
    total_paid,
    closing_balance: round2(total_invoiced - total_paid),
    currency,
  };
}
