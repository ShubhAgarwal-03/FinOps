import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import * as vendorPaymentService from '../../../../../libs/ap/vendor-payments/vendor-payments.services';

const router = Router();

const createVendorPaymentSchema = z.object({
  vendor_invoice_id: z.string().min(1, 'Invalid invoice ID'),
  amount:            z.number().positive('Amount must be positive'),
  method:            z.enum(['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other']),
  paid_at:           z.coerce.date().optional(),
  payment_ref:       z.string().max(200).optional(),
  notes:             z.string().max(1000).optional(),
});

const vendorPaymentListQuerySchema = z.object({
  page:              z.string().optional(),
  limit:             z.string().optional(),
  vendor_invoice_id: z.string().optional(),
  vendor_id:         z.string().optional(),
});

// GET /api/ap/vendor-payments
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await vendorPaymentService.listVendorPayments(req.query as any));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor payments' });
  }
});

// POST /api/ap/vendor-payments
router.post('/', validate(createVendorPaymentSchema), async (req: Request, res: Response) => {
  try {
    const payment = await vendorPaymentService.createVendorPayment(req.body);
    res.status(201).json(payment);
  } catch (err: any) {
    if (
      err.message?.includes('Payment blocked') ||
      err.message?.includes('Overpayment') ||
      err.message?.includes('not found')
    ) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create vendor payment' });
  }
});

export default router;