import { z } from 'zod';

export const createVendorPaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  amount:     z.number().positive('Amount must be positive'),
  method:     z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER']).default('BANK_TRANSFER'),
  date_paid:  z.string().datetime(),
  reference:  z.string().max(200).optional(),
  notes:      z.string().max(1000).optional(),
});

export const vendorPaymentListQuerySchema = z.object({
  page:       z.string().regex(/^\d+$/).optional().default('1'),
  limit:      z.string().regex(/^\d+$/).optional().default('20'),
  invoice_id: z.string().uuid().optional(),
  vendor_id:  z.string().uuid().optional(),
});

export type CreateVendorPaymentInput    = z.infer<typeof createVendorPaymentSchema>;
export type VendorPaymentListQueryInput = z.infer<typeof vendorPaymentListQuerySchema>;
