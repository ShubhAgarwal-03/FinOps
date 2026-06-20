/**
 * Formats a date string or Date object to 'DD Mon YYYY' format.
 * Mirrors formatDate() in pdfService.ts.
 *
 * @example formatDate('2024-03-15') → '15 Mar 2024'
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Returns today's date as a plain Date with time zeroed to midnight UTC.
 * Use for due-date validation comparisons.
 */
export function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns true if the given date is in the past (before today midnight).
 */
export function isDateInPast(date: string | Date): boolean {
  return new Date(date) < todayMidnight();
}

/**
 * Converts a Date to an ISO date string (YYYY-MM-DD) without time component.
 * Safe for use in Prisma DateTime fields that represent calendar dates.
 */
export function toISODate(date: string | Date): string {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Adds N calendar days to a date and returns the resulting Date.
 * Useful for computing due dates from payment terms.
 *
 * @example addDays(new Date('2024-01-01'), 30) → Date('2024-01-31')
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
