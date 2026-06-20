import { z } from 'zod';

// ─── GSTIN ────────────────────────────────────────────────────────────────────

/**
 * Indian GSTIN format: 15 characters
 * Pattern: 2-digit state code + 10-char PAN + 1 entity number + 1 check digit + Z
 * Example: 29ABCDE1234F1Z5
 */
export const GSTINSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Invalid GSTIN format',
  )
  .optional()
  .or(z.literal(''));

// ─── PAN ─────────────────────────────────────────────────────────────────────

/**
 * Indian PAN format: 10 characters
 * Pattern: AAAAA0000A
 */
export const PANSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
  .optional()
  .or(z.literal(''));

// ─── GST rate ─────────────────────────────────────────────────────────────────

/**
 * Valid Indian GST rates. Zero-rated (0%) is valid for exports and exempted goods.
 */
export const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 9, 12, 14, 18, 28] as const;

export const GSTRateSchema = z
  .number()
  .refine(
    (v) => VALID_GST_RATES.includes(v as typeof VALID_GST_RATES[number]),
    { message: `GST rate must be one of: ${VALID_GST_RATES.join(', ')}` },
  );

// ─── Interstate flag ──────────────────────────────────────────────────────────

export const IsInterstateSchema = z.boolean().default(true);

// ─── HSN / SAC ────────────────────────────────────────────────────────────────

export const HSNSACSchema = z
  .string()
  .min(4, 'HSN/SAC must be at least 4 digits')
  .max(8, 'HSN/SAC must be at most 8 digits')
  .regex(/^\d+$/, 'HSN/SAC must contain only digits')
  .optional()
  .or(z.literal(''));
