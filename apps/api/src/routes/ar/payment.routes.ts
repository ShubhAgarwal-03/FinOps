import { Router, Request, Response, NextFunction } from 'express';
import * as paymentService from '../../../../libs/ar/payments/payments.services';

const router = Router();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/:id/payments', wrap(async (req: Request, res: Response) => {
  const payments = await paymentService.getPaymentsByInvoice(req.params.id);
  res.json(payments);
}));

router.post('/:id/payments', wrap(async (req: Request, res: Response) => {
  const { amount, method, paid_at, notes } = req.body;
  const result = await paymentService.recordPayment(req.params.id, {
    amount: parseFloat(amount),
    method,
    paid_at: paid_at ? new Date(paid_at) : undefined,
    notes,
  });
  res.status(201).json(result);
}));

export default router;