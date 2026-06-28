import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as disputeService from '../../../../../libs/ap/disputes/disputes.services';

const router = Router();

const createDisputeSchema = z.object({
  vendor_invoice_id: z.string().min(1, 'Invalid vendor invoice ID'),
  raised_by:         z.string().max(200).optional(),
  reason:            z.string().min(1, 'Reason is required').max(2000),
  // matches service: 'vendor' | 'internal' | 'unknown'
  responsible_party: z.enum(['vendor', 'internal', 'unknown']),
});

const resolveDisputeSchema = z.object({
  resolution:        z.string().min(1, 'Resolution notes are required').max(2000),
  resolved_by:       z.string().max(200).optional(),
  resolution_action: z.enum([
    'accept_invoice',
    'request_credit_note',
    'amend_po',
    'reject_invoice',
  ]),
});

// GET /api/ap/disputes
router.get('/', async (req: Request, res: Response) => {
  try {
    const disputes = await disputeService.listDisputes(
      req.query.vendor_invoice_id as string | undefined
    );
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// GET /api/ap/disputes/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dispute = await disputeService.getDisputeById(req.params.id);
    res.json(dispute);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Dispute not found' });
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

// POST /api/ap/disputes
router.post('/', validate(createDisputeSchema), async (req: Request, res: Response) => {
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
router.post('/:id/resolve', validate(resolveDisputeSchema), async (req: Request, res: Response) => {
  try {
    const dispute = await disputeService.resolveDispute(req.params.id, req.body);
    res.json(dispute);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Dispute not found' });
    if (err.message?.includes('already resolved')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

export default router;