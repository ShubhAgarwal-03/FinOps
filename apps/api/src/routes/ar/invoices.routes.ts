import { Router, Request, Response, NextFunction } from 'express';
import { SalesInvoiceStatus } from '@prisma/client';
import * as invoiceService from '../../../../../libs/ar/invoices/invoice.services';
import { prisma } from '../../config/prisma';
import { generateInvoicePdf } from '../../../../../libs/ar/invoices/invoice-pdf.services';

const router = Router();
const wrap = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', wrap(async (req: Request, res: Response) => {
  const { status, from, to, search, page, limit } = req.query;
  const result = await invoiceService.listInvoices({
    status:  status as string,
    from:    from   as string,
    to:      to     as string,
    search:  search as string,
    page:    page   ? parseInt(page as string)  : undefined,
    limit:   limit  ? parseInt(limit as string) : undefined,
  });
  res.json(result);
}));

router.get('/:id', wrap(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
}));

router.post('/', wrap(async (req: Request, res: Response) => {
  const invoice = await invoiceService.createInvoice(req.body);
  res.status(201).json(invoice);
}));

router.put('/:id', wrap(async (req: Request, res: Response) => {
  const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
  res.json(invoice);
}));

router.post('/:id/duplicate', wrap(async (req: Request, res: Response) => {
  const invoice = await invoiceService.duplicateInvoice(req.params.id);
  res.status(201).json(invoice);
}));

router.delete('/:id', wrap(async (req: Request, res: Response) => {
  const invoice = await invoiceService.softDeleteInvoice(req.params.id);
  res.json({ message: `Invoice ${invoice.invoice_number} deleted` });
}));

router.patch('/:id/status', wrap(async (req: Request, res: Response) => {
  const { status } = req.body;
  const valid: SalesInvoiceStatus[] = ['draft', 'sent', 'paid', 'void'];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be draft, sent, paid, or void.' });
  }
  const invoice = await invoiceService.updateInvoiceStatus(req.params.id, status);
  res.json(invoice);
}));

router.get('/:id/pdf', wrap(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const company = await prisma.companySettings.findFirst();
  const pdfBuffer = await generateInvoicePdf(invoice, company);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
  res.send(pdfBuffer);
}));

export default router;