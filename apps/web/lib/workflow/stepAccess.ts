import { WorkflowStatus } from '@/types/ap';

// The 10-step PRD workflow collapses to these six sequential sidebar
// sections (Vendors is a supporting entity, not a step, so it's always open).
export type WorkflowStepKey = keyof WorkflowStatus;

export const STEP_ORDER: { key: WorkflowStepKey; label: string; prerequisiteLabel: string }[] = [
  { key: 'vendors', label: 'Vendors', prerequisiteLabel: '' },
  { key: 'requisitions', label: 'Requisitions', prerequisiteLabel: '' },
  { key: 'rfp', label: 'RFP', prerequisiteLabel: 'an approved requisition' },
  { key: 'purchase_orders', label: 'Purchase Orders', prerequisiteLabel: 'a vendor selected on an RFP' },
  { key: 'grn', label: 'GRN', prerequisiteLabel: 'an issued purchase order' },
  { key: 'vendor_invoices', label: 'Vendor Invoices', prerequisiteLabel: 'a confirmed GRN' },
  { key: 'vendor_payments', label: 'Vendor Payments', prerequisiteLabel: 'an approved vendor invoice' },
];

export interface StepAccess {
  /** Prerequisite met — this stage has at least one actionable record. */
  unlocked: boolean;
  /** Human-readable reason to show when a "New …" action is disabled. */
  reason: string;
}

// Sidebar sections and list pages are always navigable — you can look ahead
// at a stage with nothing in it yet. What's gated is the ability to *act*
// (create a new record) before the prerequisite stage has a qualifying record.
export function getStepAccess(status: WorkflowStatus, key: WorkflowStepKey): StepAccess {
  const step = STEP_ORDER.find(s => s.key === key);
  const unlocked = status[key];
  return {
    unlocked,
    reason: unlocked || !step?.prerequisiteLabel
      ? ''
      : `Requires ${step.prerequisiteLabel} before you can start this step.`,
  };
}

// Generic record-level lock: once a record has left its editable draft
// state, its detail page renders read-only. The one standing exception is
// the PO Amendment action on an issued Purchase Order.
export function isRecordLocked(status: string, editableStatuses: string[]): boolean {
  return !editableStatuses.includes(status);
}