'use client';
import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

export interface WorkflowStatus {
  vendors: boolean;
  requisitions: boolean;
  rfp: boolean;
  purchase_orders: boolean;
  grn: boolean;
  vendor_invoices: boolean;
  vendor_payments: boolean;
}

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
    apiClient
      .get<WorkflowStatus>('/api/ap/workflow-status')
      .then(r => setStatus(r.data))
      .catch(() => setStatus(DEFAULT_STATUS))
      .finally(() => setLoading(false));
  }, []);

  return { status, loading };
}