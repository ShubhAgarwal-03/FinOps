import { Router, Request, Response } from 'express';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  createPoSchema,
  updatePoSchema,
  amendPoSchema,
  poListQuerySchema,
} from './po.validator';
import * as poService from './po.service';

const router = Router();

// GET /api/ap/purchase-orders
router.get('/', validateQuery(poListQuerySchema), async (req: Request, res: Response) => {
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
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(po);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// GET /api/ap/purchase-orders/:id/amendments
router.get('/:id/amendments', async (req: Request, res: Response) => {
  try {
    const amendments = await poService.getAmendments(req.params.id);
    if (!amendments) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(amendments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch amendments' });
  }
});

// POST /api/ap/purchase-orders
router.post('/', validateBody(createPoSchema), async (req: Request, res: Response) => {
  try {
    const po = await poService.createPurchaseOrder(req.body);
    res.status(201).json(po);
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('inactive') || err.message?.includes('AWARDED')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// PUT /api/ap/purchase-orders/:id  — DRAFT only
router.put('/:id', validateBody(updatePoSchema), async (req: Request, res: Response) => {
  try {
    const po = await poService.updatePurchaseOrder(req.params.id, req.body);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(po);
  } catch (err: any) {
    if (err.message?.includes('locked')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// POST /api/ap/purchase-orders/:id/issue  — lock the PO
router.post('/:id/issue', async (req: Request, res: Response) => {
  try {
    const po = await poService.issuePurchaseOrder(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(po);
  } catch (err: any) {
    if (err.message?.includes('already') || err.message?.includes('no line items')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to issue purchase order' });
  }
});

// POST /api/ap/purchase-orders/:id/amendments  — append-only after ISSUED
router.post('/:id/amendments', validateBody(amendPoSchema), async (req: Request, res: Response) => {
  try {
    const amendment = await poService.createAmendment(req.params.id, req.body);
    if (!amendment) return res.status(404).json({ error: 'Purchase order not found' });
    res.status(201).json(amendment);
  } catch (err: any) {
    if (err.message?.includes('Only ISSUED')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Failed to create amendment' });
  }
});

// POST /api/ap/purchase-orders/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const po = await poService.cancelPurchaseOrder(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(po);
  } catch (err: any) {
    if (err.message?.includes('already') || err.message?.includes('posted GRNs')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to cancel purchase order' });
  }
});

export default router;
