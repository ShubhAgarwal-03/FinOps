import { z } from 'zod';
import { GSTINSchema, PANSchema } from './gst.validator';

// ─── Base address ─────────────────────────────────────────────────────────────

export const AddressSchema = z.object({
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city:           z.string().optional(),
  state:          z.string().optional(),
  postal_code:    z.string().optional(),
  country:        z.string().min(2, 'Country required').default('IN'),
});

// ─── GST address ──────────────────────────────────────────────────────────────

export const GSTAddressSchema = AddressSchema.extend({
  gstin: GSTINSchema,
  pan:   PANSchema,
  state: z.string().min(1, 'State required for GST address'),
});

// ─── Shipping address (free-form string, existing pattern) ────────────────────

export const ShippingAddressSchema = z.string().optional().nullable();
