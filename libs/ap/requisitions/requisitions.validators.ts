import { z } from 'zod';

const requisitionItemSchema = z.object({
  item_id:    z.string().uuid('Invalid item ID'),
  quantity:   z.number().positive('Quantity must be positive'),
  unit_price: z.number().nonnegative().optional(),
  notes:      z.string().max(500).optional(),
});

export const createRequisitionSchema = z.object({
  title:        z.string().min(1, 'Title is required').max(300),
  requested_by: z.string().max(200).optional(),
  department:   z.string().max(200).optional(),
  notes:        z.string().max(1000).optional(),
  items:        z.array(requisitionItemSchema).min(1, 'At least one item is required'),
});

export const updateRequisitionSchema = z.object({
  title:        z.string().min(1).max(300).optional(),
  requested_by: z.string().max(200).optional(),
  department:   z.string().max(200).optional(),
  notes:        z.string().max(1000).optional(),
  items:        z.array(requisitionItemSchema).min(1).optional(),
});

export const requisitionListQuerySchema = z.object({
  page:       z.string().regex(/^\d+$/).optional().default('1'),
  limit:      z.string().regex(/^\d+$/).optional().default('20'),
  search:     z.string().optional(),
  status:     z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED_TO_RFP']).optional(),
});

export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;
export type UpdateRequisitionInput = z.infer<typeof updateRequisitionSchema>;
export type RequisitionListQueryInput = z.infer<typeof requisitionListQuerySchema>;
