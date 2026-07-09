'use client';

import { useEffect, useState } from 'react';
import { workflowService } from '@/services/ap';
import { WorkflowStatus } from '@/types/ap';

// Vendors and requisitions are always reachable — everything else unlocks
// once a prior stage has a qualifying record. This is also the fallback if
// GET /api/ap/workflow-status isn't built on the backend yet.
const DEFAULT_STATUS: WorkflowStatus = {
  vendors: true,
  requisitions: true,
  rfp: false,
  purchase_orders: false,
  grn: false,
  vendor_invoices: false,
  vendor_payments: false,
};

export function useWorkflowStatus() {
  const [status, setStatus] = useState<WorkflowStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    workflowService
      .getStatus()
      .then((data: Partial<WorkflowStatus>) => {
        if (!cancelled) setStatus({ ...DEFAULT_STATUS, ...data });
      })
      .catch(() => { if (!cancelled) setStatus(DEFAULT_STATUS); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { status, loading };
}