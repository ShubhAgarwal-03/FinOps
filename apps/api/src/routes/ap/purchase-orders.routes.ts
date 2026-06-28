import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as poService from '../../../../../libs/ap/purchase-orders/po.services';
import { poImmutabilityGuard } from '../../middleware/po-immutability';

const router = Router();

const poItemSchema = z.object({
  item_id:     z.string().optional(),
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

const createPoSchema = z.object({
  vendor_id:         z.string().min(1, 'Invalid vendor ID'),
  rfp_id:            z.string().optional(),
  is_interstate:     z.boolean().default(true),
  discount_percent:  z.number().min(0).max(100).default(0),
  delivery_address:  z.string().max(500).optional(),
  expected_delivery: z.coerce.date().optional(),
  payment_terms:     z.string().max(500).optional(),
  notes:             z.string().max(1000).optional(),
  items:             z.array(poItemSchema).min(1, 'At least one line item is required'),
});

const updatePoSchema = createPoSchema.omit({ vendor_id: true, rfp_id: true }).partial();

const amendPoSchema = z.object({
  reason:      z.string().min(1, 'Amendment reason is required').max(1000),
  description: z.string().max(1000).optional(),
  amended_by:  z.string().max(200).optional(),
});

// GET /api/ap/purchase-orders
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await poService.listPurchaseOrders(req.query as any));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// GET /api/ap/purchase-orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const po = await poService.getPurchaseOrderById(req.params.id);
    res.json(po);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Purchase order not found' });
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// GET /api/ap/purchase-orders/:id/amendments
router.get('/:id/amendments', async (req: Request, res: Response) => {
  try {
    const amendments = await poService.getAmendments(req.params.id);
    res.json(amendments);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Purchase order not found' });
    res.status(500).json({ error: 'Failed to fetch amendments' });
  }
});

// POST /api/ap/purchase-orders
router.post('/', validate(createPoSchema), async (req: Request, res: Response) => {
  try {
    const po = await poService.createPurchaseOrder(req.body);
    res.status(201).json(po);
  } catch (err: any) {
    if (
      err.message?.includes('not found') ||
      err.message?.includes('inactive') ||
      err.message?.includes('AWARDED')
    ) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// PUT /api/ap/purchase-orders/:id — DRAFT only, guarded by middleware
router.put('/:id', poImmutabilityGuard, validate(updatePoSchema), async (req: Request, res: Response) => {
  try {
    const po = await poService.updatePurchaseOrder(req.params.id, req.body);
    res.json(po);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Purchase order not found' });
    if (err.message?.includes('locked')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// POST /api/ap/purchase-orders/:id/issue
router.post('/:id/issue', async (req: Request, res: Response) => {
  try {
    const po = await poService.issuePurchaseOrder(req.params.id);
    res.json(po);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Purchase order not found' });
    if (err.message?.includes('already') || err.message?.includes('no line items')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to issue purchase order' });
  }
});

// POST /api/ap/purchase-orders/:id/amendments — append-only, bypasses immutability guard
router.post('/:id/amendments', validate(amendPoSchema), async (req: Request, res: Response) => {
  try {
    const amendment = await poService.createAmendment(req.params.id, req.body);
    res.status(201).json(amendment);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Purchase order not found' });
    if (err.message?.includes('Only ISSUED')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to create amendment' });
  }
});

// POST /api/ap/purchase-orders/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const po = await poService.cancelPurchaseOrder(req.params.id);
    res.json(po);
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: 'Purchase order not found' });
    if (err.message?.includes('already') || err.message?.includes('posted GRNs')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to cancel purchase order' });
  }
});

export default router;