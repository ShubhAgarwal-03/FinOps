import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as rfpService from '../../../../../libs/ap/rfp/rfp.services';

const router = Router();

const createRfpSchema = z.object({
  requisition_id: z.string().min(1),
  title:          z.string().min(1, 'Title is required').max(300),
  description:    z.string().max(2000).optional(),
  deadline:       z.coerce.date().optional(),
});

const updateRfpSchema = z.object({
  title:       z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional(),
  deadline:    z.coerce.date().optional(),
});

const submitQuoteSchema = z.object({
  vendor_id:      z.string().min(1, 'Invalid vendor ID'),
  unit_price:     z.number().positive(),
  total_amount:   z.number().positive('Total amount must be positive'),
  lead_time_days: z.number().int().positive().optional(),
  validity_days:  z.number().int().positive().optional(),
  notes:          z.string().max(1000).optional(),
});

const evaluateRfpSchema = z.object({
  selected_quote_id: z.string().min(1, 'Invalid quote ID'),
  evaluations: z.array(z.object({
    vendor_quote_id: z.string().min(1),
    score:           z.number().int().min(1).max(100).optional(),
    price_score:     z.number().int().min(1).max(100).optional(),
    quality_score:   z.number().int().min(1).max(100).optional(),
    lead_time_score: z.number().int().min(1).max(100).optional(),
    notes:           z.string().max(500).optional(),
  })).min(1),
});

// GET /api/ap/rfp
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await rfpService.listRfps(req.query as any));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch RFPs' });
  }
});

// GET /api/ap/rfp/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rfp = await rfpService.getRfpById(req.params.id);
    res.json(rfp);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'RFP not found' });
    res.status(500).json({ error: 'Failed to fetch RFP' });
  }
});

// POST /api/ap/rfp
router.post('/', validate(createRfpSchema), async (req: Request, res: Response) => {
  try {
    const rfp = await rfpService.createRfp(req.body);
    res.status(201).json(rfp);
  } catch (err: any) {
    if (err.message?.includes('must be APPROVED') || err.message?.includes('not found')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create RFP' });
  }
});

// PUT /api/ap/rfp/:id
router.put('/:id', validate(updateRfpSchema), async (req: Request, res: Response) => {
  try {
    const rfp = await rfpService.updateRfp(req.params.id, req.body);
    res.json(rfp);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'RFP not found' });
    if (err.message?.includes('Only OPEN')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update RFP' });
  }
});

// POST /api/ap/rfp/:id/quotes
router.post('/:id/quotes', validate(submitQuoteSchema), async (req: Request, res: Response) => {
  try {
    const quote = await rfpService.submitVendorQuote(req.params.id, req.body);
    res.status(201).json(quote);
  } catch (err: any) {
    if (err.message?.includes('not open') || err.message?.includes('not active')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to submit quote' });
  }
});

// POST /api/ap/rfp/:id/evaluate
router.post('/:id/evaluate', validate(evaluateRfpSchema), async (req: Request, res: Response) => {
  try {
    const result = await rfpService.evaluateRfp(req.params.id, req.body);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('already been awarded') || err.message?.includes('does not belong')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to evaluate RFP' });
  }
});

export default router;