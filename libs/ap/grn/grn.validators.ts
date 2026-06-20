// ─── validator ───────────────────────────────────────────────────────────────
import { z } from 'zod';

const grnItemSchema = z.object({
  po_item_id:         z.string().uuid('Invalid PO item ID'),
  quantity_received:  z.number().positive('Quantity received must be positive'),
  notes:              z.string().max(500).optional(),
});

export const createGrnSchema = z.object({
  po_id:         z.string().uuid('Invalid PO ID'),
  vendor_id:     z.string().uuid('Invalid vendor ID'),
  received_by:   z.string().max(200).optional(),
  received_date: z.string().datetime().optional(),
  notes:         z.string().max(1000).optional(),
  items:         z.array(grnItemSchema).min(1, 'At least one item must be received'),
});

export const grnListQuerySchema = z.object({
  page:      z.string().regex(/^\d+$/).optional().default('1'),
  limit:     z.string().regex(/^\d+$/).optional().default('20'),
  po_id:     z.string().uuid().optional(),
  vendor_id: z.string().uuid().optional(),
  status:    z.enum(['DRAFT', 'RECEIVED', 'POSTED']).optional(),
});

export type CreateGrnInput    = z.infer<typeof createGrnSchema>;
export type GrnListQueryInput = z.infer<typeof grnListQuerySchema>;
