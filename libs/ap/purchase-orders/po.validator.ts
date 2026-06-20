import { z } from 'zod';

const poItemSchema = z.object({
  item_id:     z.string().uuid('Invalid item ID'),
  description: z.string().max(500).optional(),
  quantity:    z.number().positive('Quantity must be positive'),
  unit_price:  z.number().nonnegative('Unit price must be non-negative'),
  tax_rate:    z.number().min(0).max(100).default(0),
});

export const createPoSchema = z.object({
  vendor_id:        z.string().uuid('Invalid vendor ID'),
  rfp_id:           z.string().uuid().optional(),
  delivery_date:    z.string().datetime().optional(),
  payment_terms:    z.string().max(500).optional(),
  shipping_address: z.string().max(500).optional(),
  notes:            z.string().max(1000).optional(),
  items:            z.array(poItemSchema).min(1, 'At least one line item is required'),
});

// Update only allowed while DRAFT — same shape, all optional
export const updatePoSchema = createPoSchema.omit({ vendor_id: true, rfp_id: true }).partial();

export const amendPoSchema = z.object({
  reason:      z.string().min(1, 'Amendment reason is required').max(1000),
  changes:     z.array(z.object({
    field:     z.string(),
    old_value: z.unknown(),
    new_value: z.unknown(),
  })).min(1, 'At least one change is required'),
  amended_by:  z.string().max(200).optional(),
});

export const poListQuerySchema = z.object({
  page:      z.string().regex(/^\d+$/).optional().default('1'),
  limit:     z.string().regex(/^\d+$/).optional().default('20'),
  search:    z.string().optional(),
  status:    z.enum(['DRAFT', 'ISSUED', 'AMENDED', 'CLOSED', 'CANCELLED']).optional(),
  vendor_id: z.string().uuid().optional(),
});

export type CreatePoInput       = z.infer<typeof createPoSchema>;
export type UpdatePoInput       = z.infer<typeof updatePoSchema>;
export type AmendPoInput        = z.infer<typeof amendPoSchema>;
export type PoListQueryInput    = z.infer<typeof poListQuerySchema>;
