import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as requisitionService from '../../../../../libs/ap/requisitions/requisitions.services';
import { RequisitionStatus } from '@prisma/client';

const router = Router();

const requisitionItemSchema = z.object({
  item_id:              z.string().optional(),
  description:          z.string().min(1).max(500),
  quantity:             z.number().positive(),
  unit_of_measure:      z.string().max(50).optional(),
  estimated_unit_price: z.number().positive().optional(),
  notes:                z.string().max(500).optional(),
  sort_order:           z.number().int().optional(),
});

const createRequisitionSchema = z.object({
  title:        z.string().min(1, 'Title is required').max(300),
  description:  z.string().max(1000).optional(),
  requested_by: z.string().max(200).optional(),
  required_by:  z.coerce.date().optional(),
  items:        z.array(requisitionItemSchema).min(1, 'At least one item is required'),
});

const updateRequisitionSchema = createRequisitionSchema.partial();

// Prisma enum values are lowercase
const statusSchema = z.object({
  status:           z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'converted_to_rfp']),
  approved_by:      z.string().max(200).optional(),
  rejection_reason: z.string().max(500).optional(),
});

// GET /api/ap/requisitions
router.get('/', async (req: Request, res: Response) => {
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
    res.json(req_);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Requisition not found' });
    res.status(500).json({ error: 'Failed to fetch requisition' });
  }
});

// POST /api/ap/requisitions
router.post('/', validate(createRequisitionSchema), async (req: Request, res: Response) => {
  try {
    const requisition = await requisitionService.createRequisition(req.body);
    res.status(201).json(requisition);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

// PUT /api/ap/requisitions/:id
router.put('/:id', validate(updateRequisitionSchema), async (req: Request, res: Response) => {
  try {
    const requisition = await requisitionService.updateRequisition(req.params.id, req.body);
    res.json(requisition);
  } catch (err: any) {
    if (err.message?.includes('Cannot edit')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update requisition' });
  }
});

// PATCH /api/ap/requisitions/:id/status
router.patch('/:id/status', validate(statusSchema), async (req: Request, res: Response) => {
  try {
    const result = await requisitionService.transitionRequisitionStatus(
      req.params.id,
      req.body.status as RequisitionStatus,
      { approved_by: req.body.approved_by, rejection_reason: req.body.rejection_reason }
    );
    res.json(result);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Requisition not found' });
    if (err.message?.includes('Invalid transition')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/ap/requisitions/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await requisitionService.deleteRequisition(req.params.id);
    res.json({ message: 'Requisition deleted successfully' });
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Requisition not found' });
    if (err.message?.includes('Only DRAFT')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to delete requisition' });
  }
});

export default router;