import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  createVendorInvoiceSchema,
  updateVendorInvoiceSchema,
  vendorInvoiceListQuerySchema,
} from './vendor-invoice.validator';
import * as vendorInvoiceService from './vendor-invoice.service';
import { runAndPersistMatch } from '../match-engine/match.engine';

const router = Router();

// GET /api/ap/vendor-invoices
router.get('/', validateQuery(vendorInvoiceListQuerySchema), async (req: Request, res: Response) => {
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
    if (!invoice) return res.status(404).json({ error: 'Vendor invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices
router.post('/', validateBody(createVendorInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.createVendorInvoice(req.body);
    res.status(201).json(invoice);
  } catch (err: any) {
    const clientErrors = ['not found', 'must be ISSUED', 'does not match', 'does not belong'];
    if (clientErrors.some(e => err.message?.includes(e))) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create vendor invoice' });
  }
});

// PUT /api/ap/vendor-invoices/:id
router.put('/:id', validateBody(updateVendorInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.updateVendorInvoice(req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Vendor invoice not found' });
    res.json(invoice);
  } catch (err: any) {
    if (err.message?.includes('Only DRAFT')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices/:id/submit
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.submitVendorInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Vendor invoice not found' });
    res.json(invoice);
  } catch (err: any) {
    if (err.message?.includes('Only DRAFT') || err.message?.includes('GRN must be linked')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to submit vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices/:id/match  — trigger 3-way match
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

// POST /api/ap/vendor-invoices/:id/approve  — finance approval
const approveSchema = z.object({ approved_by: z.string().max(200).optional() });
router.post('/:id/approve', validateBody(approveSchema), async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.approveVendorInvoice(req.params.id, req.body.approved_by);
    if (!invoice) return res.status(404).json({ error: 'Vendor invoice not found' });
    res.json(invoice);
  } catch (err: any) {
    if (err.message?.includes('Only MATCHED')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to approve vendor invoice' });
  }
});

// POST /api/ap/vendor-invoices/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const invoice = await vendorInvoiceService.cancelVendorInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Vendor invoice not found' });
    res.json(invoice);
  } catch (err: any) {
    if (err.message?.includes('Cannot cancel') || err.message?.includes('already cancelled')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to cancel vendor invoice' });
  }
});

export default router;
