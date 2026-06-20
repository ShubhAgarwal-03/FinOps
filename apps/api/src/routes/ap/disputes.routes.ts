import { Router, Request, Response } from 'express';
import { validateBody } from '../../middleware/validate';
import { createDisputeSchema, resolveDisputeSchema } from './dispute.validator';
import * as disputeService from './dispute.service';

const router = Router();

// GET /api/ap/disputes?vendor_invoice_id=
router.get('/', async (req: Request, res: Response) => {
  try {
    const disputes = await disputeService.listDisputes(req.query.vendor_invoice_id as string | undefined);
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// GET /api/ap/disputes/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dispute = await disputeService.getDisputeById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    res.json(dispute);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

// POST /api/ap/disputes
router.post('/', validateBody(createDisputeSchema), async (req: Request, res: Response) => {
  try {
    const dispute = await disputeService.createDispute(req.body);
    res.status(201).json(dispute);
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('only be raised')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create dispute' });
  }
});

// POST /api/ap/disputes/:id/resolve
router.post('/:id/resolve', validateBody(resolveDisputeSchema), async (req: Request, res: Response) => {
  try {
    const dispute = await disputeService.resolveDispute(req.params.id, req.body);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    res.json(dispute);
  } catch (err: any) {
    if (err.message?.includes('already resolved')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

export default router;
