import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

const router = Router();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (_req: Request, res: Response) => {
  const items = await prisma.item.findMany({
    where: { is_deleted: false },
    orderBy: { created_at: 'desc' },
  });
  res.json(items);
}));

router.get('/:id', wrap(async (req: Request, res: Response) => {
  const item = await prisma.item.findFirst({ where: { id: req.params.id, is_deleted: false } });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}));

router.post('/', wrap(async (req: Request, res: Response) => {
  const item = await prisma.item.create({ data: req.body });
  res.status(201).json(item);
}));

router.put('/:id', wrap(async (req: Request, res: Response) => {
  const item = await prisma.item.update({ where: { id: req.params.id }, data: req.body });
  res.json(item);
}));

router.delete('/:id', wrap(async (req: Request, res: Response) => {
  await prisma.item.update({
    where: { id: req.params.id },
    data: { is_deleted: true, deleted_at: new Date() },
  });
  res.json({ message: 'Item deleted' });
}));

export default router;