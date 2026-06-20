// ─── Entry direction ─────────────────────────────────────────────────────────

export type LedgerDirection = 'DEBIT' | 'CREDIT';

// ─── Entry type ──────────────────────────────────────────────────────────────

/**
 * What kind of financial event created this ledger row.
 *
 * AR usage:
 *   INVOICE_RAISED  — debit the customer (they owe us)
 *   PAYMENT_RECEIVED — credit the customer (they paid us)
 *
 * AP usage:
 *   INVOICE_RECEIVED — credit the vendor (we owe them)
 *   PAYMENT_MADE     — debit the vendor (we paid them)
 */
export type EntryType =
  | 'INVOICE_RAISED'
  | 'PAYMENT_RECEIVED'
  | 'CREDIT_NOTE'
  | 'INVOICE_RECEIVED'
  | 'PAYMENT_MADE'
  | 'DEBIT_NOTE';

// ─── Single ledger entry ──────────────────────────────────────────────────────

/**
 * One row in a customer or vendor ledger.
 *
 * Design note: the running balance is computed at read time by
 * ledger.engine.ts — it is never stored in the DB to avoid drift.
 */
export interface LedgerEntry {
  /** ISO date string of the transaction */
  date: string;
  description: string;
  /** Reference to the originating document */
  reference_number?: string;
  /** FK to the originating document */
  reference_id?: string;
  entry_type: EntryType;
  direction: LedgerDirection;
  /** Positive number representing the transaction amount */
  amount: number;
  /**
   * Running balance calculated by ledger.engine.ts.
   * Positive = amount owed TO US (AR) or BY US (AP), depending on context.
   */
  running_balance: number;
}

// ─── Ledger summary ───────────────────────────────────────────────────────────

export interface LedgerSummary {
  total_invoiced: number;
  total_paid: number;
  closing_balance: number;
  currency: string;
}

// ─── Full ledger response ─────────────────────────────────────────────────────

export interface LedgerResponse<TEntity> {
  entity: TEntity;
  entries: LedgerEntry[];
  summary: LedgerSummary;
}
