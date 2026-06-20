import { z } from 'zod';

const vendorInvoiceItemSchema = z.object({
  po_item_id:  z.string().uuid('Invalid PO item ID'),
  item_id:     z.string().uuid('Invalid item ID'),
  description: z.string().max(500).optional(),
  quantity:    z.number().positive('Quantity must be positive'),
  unit_price:  z.number().nonnegative('Unit price must be non-negative'),
  tax_rate:    z.number().min(0).max(100).default(0),
});

export const createVendorInvoiceSchema = z.object({
  vendor_id:            z.string().uuid('Invalid vendor ID'),
  po_id:                z.string().uuid('Invalid PO ID'),
  grn_id:               z.string().uuid('Invalid GRN ID').optional(),
  vendor_invoice_date:  z.string().datetime(),
  due_date:             z.string().datetime().optional(),
  payment_terms:        z.string().max(500).optional(),
  notes:                z.string().max(1000).optional(),
  items:                z.array(vendorInvoiceItemSchema).min(1, 'At least one line item required'),
});

export const updateVendorInvoiceSchema = z.object({
  grn_id:              z.string().uuid().optional(),
  vendor_invoice_date: z.string().datetime().optional(),
  due_date:            z.string().datetime().optional(),
  payment_terms:       z.string().max(500).optional(),
  notes:               z.string().max(1000).optional(),
  items:               z.array(vendorInvoiceItemSchema).min(1).optional(),
});

export const vendorInvoiceListQuerySchema = z.object({
  page:      z.string().regex(/^\d+$/).optional().default('1'),
  limit:     z.string().regex(/^\d+$/).optional().default('20'),
  search:    z.string().optional(),
  status:    z.enum(['DRAFT', 'SUBMITTED', 'MATCHED', 'DISPUTED', 'APPROVED', 'PAID', 'CANCELLED']).optional(),
  vendor_id: z.string().uuid().optional(),
  po_id:     z.string().uuid().optional(),
});

export type CreateVendorInvoiceInput    = z.infer<typeof createVendorInvoiceSchema>;
export type UpdateVendorInvoiceInput    = z.infer<typeof updateVendorInvoiceSchema>;
export type VendorInvoiceListQueryInput = z.infer<typeof vendorInvoiceListQuerySchema>;
