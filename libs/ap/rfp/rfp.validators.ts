import { z } from 'zod';

const quoteItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity:    z.number().positive(),
  unit_price:  z.number().nonnegative(),
  total:       z.number().nonnegative(),
});

export const createRfpSchema = z.object({
  requisition_id: z.string().uuid().optional(),
  title:          z.string().min(1, 'Title is required').max(300),
  description:    z.string().max(2000).optional(),
  deadline:       z.string().datetime().optional(),
});

export const updateRfpSchema = createRfpSchema.partial().extend({
  status: z.enum(['OPEN', 'CLOSED', 'AWARDED', 'CANCELLED']).optional(),
});

export const submitQuoteSchema = z.object({
  vendor_id:     z.string().uuid('Invalid vendor ID'),
  total_amount:  z.number().positive('Total amount must be positive'),
  validity_date: z.string().datetime().optional(),
  notes:         z.string().max(1000).optional(),
  quote_items:   z.array(quoteItemSchema).min(1, 'At least one quote item required'),
});

export const updateQuoteStatusSchema = z.object({
  status: z.enum(['SUBMITTED', 'SHORTLISTED', 'REJECTED', 'AWARDED']),
});

export const evaluateRfpSchema = z.object({
  selected_quote_id:  z.string().uuid('Invalid quote ID'),
  evaluation_notes:   z.string().max(2000).optional(),
  evaluated_by:       z.string().max(200).optional(),
});

export const rfpListQuerySchema = z.object({
  page:   z.string().regex(/^\d+$/).optional().default('1'),
  limit:  z.string().regex(/^\d+$/).optional().default('20'),
  search: z.string().optional(),
  status: z.enum(['OPEN', 'CLOSED', 'AWARDED', 'CANCELLED']).optional(),
});

export type CreateRfpInput          = z.infer<typeof createRfpSchema>;
export type UpdateRfpInput          = z.infer<typeof updateRfpSchema>;
export type SubmitQuoteInput        = z.infer<typeof submitQuoteSchema>;
export type UpdateQuoteStatusInput  = z.infer<typeof updateQuoteStatusSchema>;
export type EvaluateRfpInput        = z.infer<typeof evaluateRfpSchema>;
export type RfpListQueryInput       = z.infer<typeof rfpListQuerySchema>;
