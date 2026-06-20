import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

const router = Router();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (_req: Request, res: Response) => {
  const company = await prisma.companySettings.findFirst();
  res.json(company ?? {});
}));

router.post('/', wrap(async (req: Request, res: Response) => {
  const existing = await prisma.companySettings.findFirst();
  const company = existing
    ? await prisma.companySettings.update({ where: { id: existing.id }, data: req.body })
    : await prisma.companySettings.create({ data: req.body });
  res.json(company);
}));

export default router;