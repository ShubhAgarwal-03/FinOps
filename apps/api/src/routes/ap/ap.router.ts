import { Router } from 'express';
import vendorRoutes         from './vendors.routes';
import requisitionRoutes    from './requisitions.routes';
import rfpRoutes            from './rfp.routes';
import poRoutes             from './purchase-orders.routes';
import grnRoutes            from './grn.routes';
import vendorInvoiceRoutes  from './vendor-invoices.routes';
import disputeRoutes        from './disputes.routes';
import vendorPaymentRoutes  from './vendor-payments.routes';

const router = Router();

router.use('/vendors',          vendorRoutes);
router.use('/requisitions',     requisitionRoutes);
router.use('/rfp',              rfpRoutes);
router.use('/purchase-orders',  poRoutes);
router.use('/grn',              grnRoutes);
router.use('/vendor-invoices',  vendorInvoiceRoutes);
router.use('/disputes',         disputeRoutes);
router.use('/vendor-payments',  vendorPaymentRoutes);

export default router;
