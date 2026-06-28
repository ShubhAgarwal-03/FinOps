import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as grnService from '../../../../../libs/ap/grn/grn.services';

const router = Router();

const grnItemSchema = z.object({
  po_item_id: z.string().min(1, 'Invalid PO item ID'),
  quantity_received: z.number().positive('Quantity received must be positive'),
  notes: z.string().max(500).optional(),
});

const createGrnSchema = z.object({
  po_id: z.string().min(1, 'Invalid PO ID'),
  received_by: z.string().max(200).optional(),
  received_at: z.coerce.date().optional(),
  delivery_note_number: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(grnItemSchema).min(1, 'At least one item must be received'),
});

// GET /api/ap/grn
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await grnService.listGrns(req.query as any));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch GRNs' });
  }
});

// GET /api/ap/grn/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const grn = await grnService.getGrnById(req.params.id);
    res.json(grn);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'GRN not found' });
    res.status(500).json({ error: 'Failed to fetch GRN' });
  }
});

// POST /api/ap/grn
router.post('/', validate(createGrnSchema), async (req: Request, res: Response) => {
  try {
    const grn = await grnService.createGrn(req.body);
    res.status(201).json(grn);
  } catch (err: any) {
    const clientErrors = ['not found', 'must be ISSUED', 'does not match', 'does not belong'];
    if (clientErrors.some((e) => err.message?.includes(e))) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create GRN' });
  }
});

// PATCH /api/ap/grn/:id/confirm — locks quantities, unlocks 3-way matching
router.patch('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const grn = await grnService.confirmGrn(req.params.id);
    res.json(grn);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'GRN not found' });
    if (err.message?.includes('already confirmed')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to confirm GRN' });
  }
});

export default router;