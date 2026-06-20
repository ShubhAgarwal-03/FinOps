import { Router, Request, Response } from 'express';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  createRfpSchema,
  updateRfpSchema,
  submitQuoteSchema,
  updateQuoteStatusSchema,
  evaluateRfpSchema,
  rfpListQuerySchema,
} from './rfp.validator';
import * as rfpService from './rfp.service';

const router = Router();

// GET /api/ap/rfp
router.get('/', validateQuery(rfpListQuerySchema), async (req: Request, res: Response) => {
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
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });
    res.json(rfp);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch RFP' });
  }
});

// POST /api/ap/rfp
router.post('/', validateBody(createRfpSchema), async (req: Request, res: Response) => {
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
router.put('/:id', validateBody(updateRfpSchema), async (req: Request, res: Response) => {
  try {
    const rfp = await rfpService.updateRfp(req.params.id, req.body);
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });
    res.json(rfp);
  } catch (err: any) {
    if (err.message?.includes('Only OPEN')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update RFP' });
  }
});

// POST /api/ap/rfp/:id/quotes  — vendor submits a quote
router.post('/:id/quotes', validateBody(submitQuoteSchema), async (req: Request, res: Response) => {
  try {
    const quote = await rfpService.submitVendorQuote(req.params.id, req.body);
    if (!quote) return res.status(404).json({ error: 'RFP not found' });
    res.status(201).json(quote);
  } catch (err: any) {
    if (err.message?.includes('not open') || err.message?.includes('not active')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to submit quote' });
  }
});

// PATCH /api/ap/rfp/quotes/:quoteId/status  — shortlist or reject a quote
router.patch('/quotes/:quoteId/status', validateBody(updateQuoteStatusSchema), async (req: Request, res: Response) => {
  try {
    const quote = await rfpService.updateQuoteStatus(req.params.quoteId, req.body);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update quote status' });
  }
});

// POST /api/ap/rfp/:id/evaluate  — select winning vendor
router.post('/:id/evaluate', validateBody(evaluateRfpSchema), async (req: Request, res: Response) => {
  try {
    const result = await rfpService.evaluateRfp(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'RFP not found' });
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('already been awarded') || err.message?.includes('does not belong')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to evaluate RFP' });
  }
});

export default router;
