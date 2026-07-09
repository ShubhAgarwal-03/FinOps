'use client';

import { useEffect, useState } from 'react';
import {
  requisitionsService, rfpService, purchaseOrdersService,
  grnService, vendorInvoicesService,
} from '@/services/ap';
import { WorkflowStatus } from '@/types/ap';

// There is no GET /api/ap/workflow-status route on the backend — this was
// wrong in the previous version, which imported a `workflowService` that
// doesn't exist in your real services/ap file. Instead, each stage's lock
// state is derived from whether a qualifying record already exists
// upstream, using the same getAll() calls every list page already makes.
const DEFAULT_STATUS: WorkflowStatus = {
  vendors: true,
  requisitions: true,
  rfp: false,
  purchase_orders: false,
  grn: false,
  vendor_invoices: false,
  vendor_payments: false,
};

async function hasAny(promise: Promise<{ pagination: { total: number } }>): Promise<boolean> {
  try {
    const res = await promise;
    return res.pagination.total > 0;
  } catch {
    // Endpoint not built yet, or filter unsupported — fail closed (locked)
    // rather than throw and break the sidebar.
    return false;
  }
}

export function useWorkflowStatus() {
  const [status, setStatus] = useState<WorkflowStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [
        hasApprovedRequisition,
        hasVendorSelectedRfp,
        hasIssuedPO,
        hasConfirmedGrn,
        hasApprovedInvoice,
      ] = await Promise.all([
        hasAny(requisitionsService.getAll({ status: 'approved', limit: 1 })),
        hasAny(rfpService.getAll({ status: 'vendor_selected', limit: 1 })),
        hasAny(purchaseOrdersService.getAll({ status: 'issued', limit: 1 })),
        hasAny(grnService.getAll({ status: 'confirmed', limit: 1 })),
        hasAny(vendorInvoicesService.getAll({ status: 'approved', limit: 1 })),
      ]);

      if (cancelled) return;
      setStatus({
        vendors: true,
        requisitions: true,
        rfp: hasApprovedRequisition,       // RFP unlocks once a requisition is approved
        purchase_orders: hasVendorSelectedRfp, // PO unlocks once an RFP has a selected vendor
        grn: hasIssuedPO,                  // GRN unlocks once a PO is issued
        vendor_invoices: hasConfirmedGrn,  // Vendor invoice unlocks once a GRN is confirmed
        vendor_payments: hasApprovedInvoice, // Payment unlocks once an invoice is Finance-approved
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { status, loading };
}