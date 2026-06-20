import { Router } from 'express';
import vendorRoutes         from './vendors/vendors.routes';
import requisitionRoutes    from './requisitions/requisitions.routes';
import rfpRoutes            from './rfp/rfp.routes';
import poRoutes             from './purchase-orders/po.routes';
import grnRoutes            from './grn/grn.routes';
import vendorInvoiceRoutes  from './vendor-invoices/vendor-invoices.routes';
import disputeRoutes        from './disputes/disputes.routes';
import vendorPaymentRoutes  from './vendor-payments/vendor-payments.routes';

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
