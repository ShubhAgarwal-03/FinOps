import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// AR routes
import customerRoutes from './routes/ar/customers.routes';
import invoiceRoutes from './routes/ar/invoices.routes';
import paymentRoutes from './routes/ar/payments.routes';

// AP routes (stubs — filled in later phases)
import vendorRoutes from './routes/ap/vendors.routes';
import requisitionRoutes from './routes/ap/requisitions.routes';
import rfpRoutes from './routes/ap/rfp.routes';
import purchaseOrderRoutes from './routes/ap/purchase-orders.routes';
import grnRoutes from './routes/ap/grn.routes';
import vendorInvoiceRoutes from './routes/ap/vendor-invoices.routes';
import matchRoutes from './routes/ap/match.routes';
import disputeRoutes from './routes/ap/disputes.routes';
import vendorPaymentRoutes from './routes/ap/vendor-payments.routes';

// Shared routes
import companyRoutes from './routes/company.routes';
import itemRoutes from './routes/items.routes';
import dashboardRoutes from './routes/dashboard.routes';

import { errorHandler } from './middleware/error-handler';

const app = express();

// ── Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:3000',
    process.env.FRONTEND_URL ?? '',
  ].filter(Boolean),
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health ────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── AR routes ─────────────────────────────────────────────
app.use('/api/ar/customers', customerRoutes);
app.use('/api/ar/invoices', invoiceRoutes);
app.use('/api/ar/invoices', paymentRoutes);   // payments nest under /api/ar/invoices/:id/payments

// ── AP routes ─────────────────────────────────────────────
app.use('/api/ap/vendors', vendorRoutes);
app.use('/api/ap/requisitions', requisitionRoutes);
app.use('/api/ap/rfp', rfpRoutes);
app.use('/api/ap/purchase-orders', purchaseOrderRoutes);
app.use('/api/ap/grn', grnRoutes);
app.use('/api/ap/vendor-invoices', vendorInvoiceRoutes);
app.use('/api/ap/match', matchRoutes);
app.use('/api/ap/disputes', disputeRoutes);
app.use('/api/ap/vendor-payments', vendorPaymentRoutes);

// ── Shared routes ─────────────────────────────────────────
app.use('/api/company', companyRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler (must be last) ─────────────────────────
app.use(errorHandler);

export default app;