import { Router, Request, Response } from 'express';
import { validateBody, validateQuery } from '../../middleware/validate';
import { createGrnSchema, grnListQuerySchema } from './grn.validator';
import * as grnService from './grn.service';

const router = Router();

router.get('/', validateQuery(grnListQuerySchema), async (req: Request, res: Response) => {
  try {
    res.json(await grnService.listGrns(req.query as any));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch GRNs' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const grn = await grnService.getGrnById(req.params.id);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    res.json(grn);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch GRN' });
  }
});

router.post('/', validateBody(createGrnSchema), async (req: Request, res: Response) => {
  try {
    const grn = await grnService.createGrn(req.body);
    res.status(201).json(grn);
  } catch (err: any) {
    const clientErrors = ['not found', 'must be ISSUED', 'Cancelled', 'does not match', 'does not belong'];
    if (clientErrors.some(e => err.message?.includes(e))) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create GRN' });
  }
});

router.post('/:id/post', async (req: Request, res: Response) => {
  try {
    const grn = await grnService.postGrn(req.params.id);
    if (!grn) return res.status(404).json({ error: 'GRN not found' });
    res.json(grn);
  } catch (err: any) {
    if (err.message?.includes('already') || err.message?.includes('Only RECEIVED')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to post GRN' });
  }
});

export default router;
