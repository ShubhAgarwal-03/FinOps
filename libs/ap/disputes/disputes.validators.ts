import { z } from 'zod';

export const createDisputeSchema = z.object({
  vendor_invoice_id:  z.string().uuid('Invalid vendor invoice ID'),
  responsible_party:  z.enum(['VENDOR', 'BUYER']),
  reason:             z.string().min(1, 'Reason is required').max(2000),
});

export const resolveDisputeSchema = z.object({
  resolution_notes:            z.string().min(1, 'Resolution notes are required').max(2000),
  resolved_by:                 z.string().max(200).optional(),
  resolution_po_amendment_id:  z.string().uuid().optional(),
  resolution_invoice_id:       z.string().uuid().optional(),
});

export type CreateDisputeInput  = z.infer<typeof createDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
