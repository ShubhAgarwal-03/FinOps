// ─── Country → Currency map ───────────────────────────────────────────────────
// Migrated from apps/api/src/utils/countryCurrency.ts

export const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR',
  IT: 'EUR', ES: 'EUR', AU: 'AUD', CA: 'CAD', JP: 'JPY',
  CN: 'CNY', SG: 'SGD', AE: 'AED', BR: 'BRL', MX: 'MXN',
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', NZ: 'NZD', CH: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', RU: 'RUB',
  KR: 'KRW', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP',
};

export const COUNTRY_LOCALE: Record<string, string> = {
  IN: 'en-IN', US: 'en-US', GB: 'en-GB', DE: 'de-DE',
  FR: 'fr-FR', AU: 'en-AU', CA: 'en-CA', JP: 'ja-JP',
  SG: 'en-SG', AE: 'ar-AE',
};

export function getCurrencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode?.toUpperCase()] ?? 'USD';
}

export function getLocaleForCountry(countryCode: string): string {
  return COUNTRY_LOCALE[countryCode?.toUpperCase()] ?? 'en-US';
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Formats a monetary amount for display.
 * Mirrors formatMoney() in pdfService.ts.
 *
 * @example
 *   formatCurrency(1500.5, 'INR', 'IN') → '₹1,500.50'
 */
export function formatCurrency(
  amount: number,
  currency: string,
  countryCode = 'IN',
): string {
  try {
    const locale = getLocaleForCountry(countryCode);
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Parses a localised currency string back to a number.
 * Strips currency symbols and thousand separators.
 * Use for form input parsing only — never for stored values.
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Amount in words (Indian crore/lakh) ─────────────────────────────────────
// Migrated from pdfService.ts numberToWords()

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
  'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertHundreds(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n] + ' ';
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '') + ' ';
  return ONES[Math.floor(n / 100)] + ' Hundred ' + convertHundreds(n % 100);
}

/**
 * Converts a number to Indian-English words (crore / lakh system).
 * Used in PDF "Amount in Words" blocks.
 *
 * @example numberToWords(1500.50) → 'One Thousand Five Hundred and Fifty Paise Only'
 */
export function numberToWords(amount: number): string {
  if (amount === 0) return 'Zero Only';

  const intPart  = Math.floor(amount);
  const decPart  = Math.round((amount - intPart) * 100);
  let result = '';

  if (intPart >= 10_000_000) result += convertHundreds(Math.floor(intPart / 10_000_000)) + 'Crore ';
  if (intPart >= 100_000)    result += convertHundreds(Math.floor((intPart % 10_000_000) / 100_000)) + 'Lakh ';
  if (intPart >= 1_000)      result += convertHundreds(Math.floor((intPart % 100_000) / 1_000)) + 'Thousand ';
  result += convertHundreds(intPart % 1_000);

  if (decPart > 0) result += 'and ' + convertHundreds(decPart) + 'Paise ';

  return result.trim() + ' Only';
}
