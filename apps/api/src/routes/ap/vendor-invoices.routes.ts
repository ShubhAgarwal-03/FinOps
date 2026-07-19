import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as vendorInvoiceService from '../../../../../libs/ap/vendor-invoices/vendor-invoices.services';
import { runAndPersistMatch } from '../../../../../libs/ap/match-engine/match.engine';

const router = Router();

const vendorInvoiceItemSchema = z.object({
  po_item_id:  z.string().min(1, 'Invalid PO item ID'),
  description: z.string().min(1).max(500),
  hsn_sac:     z.string().max(20).optional(),
  quantity:    z.number().positive('Quantity must be positive'),
  unit_price:  z.number().nonnegative('Unit price must be non-negative'),
  tax_lines:   z.array(z.object({
    name:    z.string().min(1),
    percent: z.number().min(0).max(100),
  })).default([]),
  sort_order: z.number().int().optional(),
});

const createVendorInvoiceSchema = z.object({
  po_id:             z.string().min(1, 'Invalid PO ID'),
  grn_id:            z.string().min(1, 'Invalid GRN ID'),
  vendor_ref_number: z.string().max(100).optional(),
  invoice_date:      z.coerce.date().max(new Date(), 'Invoice date cannot be in the future').optional(),
  due_date:          z.coerce.date().optional(),
  is_interstate:     z.boolean().default(true),
  discount_percent:  z.number().min(0).max(100).default(0),
  notes:             z.string().max(1000).optional(),
  payment_terms:     z.string().max(500).optional(),
  items:             z.array(vendorInvoiceItemSchema).min(1, 'At least one line item required'),
});

const updateVendorInvoiceSchema = z.object({
  due_date:         z.coerce.date().optional(),
  is_interstate:    z.boolean().optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  notes:            z.string().max(1000).optional(),
  payment_terms:    z.string().max(500).optional(),
  items:            z.array(vendorInvoiceItemSchema).min(1).optional(),
});

const approveSchema = z.object({
  approved_by: z.string().max(200).optional(),
});

// GET /api/ap/vendor-invoices
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await vendorInvoiceService.listVendorInvoices(req.query as any));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor invoices' });
  }
});

// GET /api/ap/vendor-invoices/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.getVendorInvoiceById(req.params.id);
    res.json(invoice);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Vendor invoice not found' });
    res.status(500).json({ error: 'Failed to fetch vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices
router.post('/', validate(createVendorInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.createVendorInvoice(req.body);
    res.status(201).json(invoice);
  } catch (err: any) {
    const clientErrors = ['not found', 'must be ISSUED', 'does not match', 'does not belong', 'must be POSTED'];
    if (clientErrors.some(e => err.message?.includes(e))) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create vendor invoice' });
  }
});

// PUT /api/ap/vendor-invoices/:id
router.put('/:id', validate(updateVendorInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.updateVendorInvoice(req.params.id, req.body);
    res.json(invoice);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Vendor invoice not found' });
    if (err.message?.includes('Only DRAFT')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices/:id/submit
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.submitVendorInvoice(req.params.id);
    res.json(invoice);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Vendor invoice not found' });
    if (err.message?.includes('Only DRAFT') || err.message?.includes('GRN must be linked')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to submit vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices/:id/match
router.post('/:id/match', async (req: Request, res: Response) => {
  try {
    const result = await runAndPersistMatch(req.params.id);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('No GRN')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to run match' });
  }
});

// POST /api/ap/vendor-invoices/:id/approve
router.post('/:id/approve', validate(approveSchema), async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.approveVendorInvoice(req.params.id, req.body.approved_by);
    res.json(invoice);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Vendor invoice not found' });
    if (err.message?.includes('Only MATCHED')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to approve vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.cancelVendorInvoice(req.params.id);
    res.json(invoice);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Vendor invoice not found' });
    if (err.message?.includes('Cannot cancel') || err.message?.includes('already cancelled')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to cancel vendor invoice' });
  }
});

export default router;