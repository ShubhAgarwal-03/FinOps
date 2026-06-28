import { Router, Request, Response } from 'express';
import { runAndPersistMatch } from '../../../../../libs/ap/match-engine/match.engine';
import { prisma } from '../../config/prisma';

const router = Router();

// GET /api/ap/match/:vendor_invoice_id
router.get('/:vendor_invoice_id', async (req: Request, res: Response) => {
  try {
    const result = await prisma.matchResult.findFirst({
      where:   { vendor_invoice_id: req.params.vendor_invoice_id },
    });
    if (!result) return res.status(404).json({ error: 'No match result found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch match result' });
  }
});

// POST /api/ap/match/:vendor_invoice_id/run
router.post('/:vendor_invoice_id/run', async (req: Request, res: Response) => {
  try {
    const result = await runAndPersistMatch(req.params.vendor_invoice_id);
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('No GRN')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to run match' });
  }
});

export default router;