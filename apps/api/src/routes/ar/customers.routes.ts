import { Router, Request, Response, NextFunction } from 'express';
import * as customerService from '../../../../libs/ar/customers/customers.services';
import { getCustomerLedger } from '../../../../libs/ar/customers/customers-ledger.services';

const router = Router();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (_req: Request, res: Response) => {
  const customers = await customerService.listCustomers();
  res.json(customers);
}));

router.get('/:id/ledger', wrap(async (req: Request, res: Response) => {
  const data = await getCustomerLedger(req.params.id);
  res.json(data);
}));

router.get('/:id', wrap(async (req: Request, res: Response) => {
  const customer = await customerService.getCustomerById(req.params.id);
  res.json(customer);
}));

router.post('/', wrap(async (req: Request, res: Response) => {
  const customer = await customerService.createCustomer(req.body);
  res.status(201).json(customer);
}));

router.put('/:id', wrap(async (req: Request, res: Response) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body);
  res.json(customer);
}));

router.delete('/:id', wrap(async (req: Request, res: Response) => {
  await customerService.softDeleteCustomer(req.params.id);
  res.json({ message: 'Customer deleted' });
}));

export default router;