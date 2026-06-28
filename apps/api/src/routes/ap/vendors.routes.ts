import { Router, Request, Response, NextFunction } from 'express';
import * as vendorService from '../../../../../libs/ap/vendors/vendors.services';

const router = Router();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req: Request, res: Response) => {
  res.json(await vendorService.listVendors(req.query as any));
}));

router.get('/:id/ledger', wrap(async (req: Request, res: Response) => {
  res.json(await vendorService.getVendorLedger(req.params.id));
}));

router.get('/:id', wrap(async (req: Request, res: Response) => {
  res.json(await vendorService.getVendorById(req.params.id));
}));

router.post('/', wrap(async (req: Request, res: Response) => {
  res.status(201).json(await vendorService.createVendor(req.body));
}));

router.put('/:id', wrap(async (req: Request, res: Response) => {
  res.json(await vendorService.updateVendor(req.params.id, req.body));
}));

router.delete('/:id', wrap(async (req: Request, res: Response) => {
  await vendorService.deleteVendor(req.params.id);
  res.json({ message: 'Vendor deleted' });
}));

export default router;