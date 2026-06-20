import { Router, Request, Response } from 'express';
import { validateBody, validateQuery } from '../../middleware/validate';
import { createVendorPaymentSchema, vendorPaymentListQuerySchema } from './vendor-payment.validator';
import * as vendorPaymentService from './vendor-payment.service';

const router = Router();

// GET /api/ap/vendor-payments
router.get('/', validateQuery(vendorPaymentListQuerySchema), async (req: Request, res: Response) => {
  try {
    res.json(await vendorPaymentService.listVendorPayments(req.query as any));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor payments' });
  }
});

// POST /api/ap/vendor-payments
router.post('/', validateBody(createVendorPaymentSchema), async (req: Request, res: Response) => {
  try {
    const payment = await vendorPaymentService.createVendorPayment(req.body);
    res.status(201).json(payment);
  } catch (err: any) {
    if (err.message?.includes('Payment blocked') || err.message?.includes('Overpayment') || err.message?.includes('not found')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create vendor payment' });
  }
});

export default router;
