import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

/**
 * Blocks any mutating request (POST, PUT, PATCH, DELETE) on a PO
 * that has already been issued (issued_at is set / status !== 'draft').
 *
 * Mount BEFORE the route handler on all PO write endpoints:
 *   router.put('/:id', poImmutabilityGuard, handler)
 *
 * Amendments bypass this — they go to /purchase-orders/:id/amendments
 * which does NOT use this middleware.
 */
export async function poImmutabilityGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) { next(); return; }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { issued_at: true, status: true, po_number: true },
    });

    if (!po) { next(); return; } // 404 handled by route

    if (po.issued_at !== null) {
      res.status(409).json({
        error: `Purchase Order ${po.po_number} is locked (issued). Use an amendment to make corrections.`,
        code: 'PO_LOCKED',
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}