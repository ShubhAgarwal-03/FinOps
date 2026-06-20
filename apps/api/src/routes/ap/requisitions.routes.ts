import { Router, Request, Response } from 'express';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  createRequisitionSchema,
  updateRequisitionSchema,
  requisitionListQuerySchema,
} from './requisition.validator';
import * as requisitionService from './requisition.service';
import { z } from 'zod';

const router = Router();

// GET /api/ap/requisitions
router.get('/', validateQuery(requisitionListQuerySchema), async (req: Request, res: Response) => {
  try {
    const result = await requisitionService.listRequisitions(req.query as any);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

// GET /api/ap/requisitions/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const req_ = await requisitionService.getRequisitionById(req.params.id);
    if (!req_) return res.status(404).json({ error: 'Requisition not found' });
    res.json(req_);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requisition' });
  }
});

// POST /api/ap/requisitions
router.post('/', validateBody(createRequisitionSchema), async (req: Request, res: Response) => {
  try {
    const requisition = await requisitionService.createRequisition(req.body);
    res.status(201).json(requisition);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

// PUT /api/ap/requisitions/:id
router.put('/:id', validateBody(updateRequisitionSchema), async (req: Request, res: Response) => {
  try {
    const requisition = await requisitionService.updateRequisition(req.params.id, req.body);
    if (!requisition) return res.status(404).json({ error: 'Requisition not found' });
    res.json(requisition);
  } catch (err: any) {
    if (err.message?.includes('Cannot edit')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update requisition' });
  }
});

// PATCH /api/ap/requisitions/:id/status
const statusSchema = z.object({
  status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'DRAFT', 'CONVERTED_TO_RFP']),
});

router.patch('/:id/status', validateBody(statusSchema), async (req: Request, res: Response) => {
  try {
    const result = await requisitionService.transitionRequisitionStatus(
      req.params.id,
      req.body.status
    );
    if (!result) return res.status(404).json({ error: 'Requisition not found' });
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('Invalid transition')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/ap/requisitions/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await requisitionService.deleteRequisition(req.params.id);
    if (!result) return res.status(404).json({ error: 'Requisition not found' });
    res.json({ message: 'Requisition deleted successfully' });
  } catch (err: any) {
    if (err.message?.includes('Only DRAFT')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete requisition' });
  }
});

export default router;
