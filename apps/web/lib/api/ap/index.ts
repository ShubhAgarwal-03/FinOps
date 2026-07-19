// ─────────────────────────────────────────────────────────────────────────
// apps/web/lib/api/ap/index.ts
// AP Services — mirrors invoicesService pattern exactly
// All routes under /api/ap/*
//
// Each section has been checked against the actual Express routes it calls —
// see inline notes wherever a call was corrected to match what the backend
// really exposes (method, path, or field name).
// ─────────────────────────────────────────────────────────────────────────

import apiClient from '@/services/apiClient';
import { buildParams } from '@/lib/api/query-params';
import type {
  Vendor, Requisition, RFP, VendorQuote, QuoteEvaluation,
  PurchaseOrder, POItem, POAmendment, GRN, GRNItem, VendorInvoice,
  MatchResultPayload, DisputeRecord, VendorPayment, RequisitionItem,
  VendorLedgerResponse, PaginatedResponse, VendorInvoiceItem,
} from '@/types/ap';

// ── Vendors ────────────────────────────────────────────────────────────

export interface VendorFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export const vendorsService = {
  getAll: (filters: VendorFilters = {}) =>
    apiClient.get<PaginatedResponse<Vendor>>(`/api/ap/vendors?${buildParams(filters)}`).then(r => r.data),
  getOne: (id: string) =>
    apiClient.get<Vendor>(`/api/ap/vendors/${id}`).then(r => r.data),
  create: (data: Partial<Vendor>) =>
    apiClient.post<Vendor>('/api/ap/vendors', data).then(r => r.data),
  update: (id: string, data: Partial<Vendor>) =>
    apiClient.put<Vendor>(`/api/ap/vendors/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/api/ap/vendors/${id}`).then(r => r.data),
  getLedger: (id: string) =>
    apiClient.get<VendorLedgerResponse>(`/api/ap/vendors/${id}/ledger`).then(r => r.data),
};

// ── Requisitions ───────────────────────────────────────────────────────

export interface RequisitionFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Backend only exposes PATCH /:id/status (no /submit, /approve, /reject routes).
// Status values match RequisitionStatus in schema.prisma:
//   draft → pending_approval → approved | rejected → converted_to_rfp
const transitionRequisitionStatus = (
  id: string,
  status: 'pending_approval' | 'approved' | 'rejected' | 'converted_to_rfp',
  meta?: { approved_by?: string; rejection_reason?: string },
) =>
  apiClient
    .patch<Requisition>(`/api/ap/requisitions/${id}/status`, { status, ...meta })
    .then(r => r.data);

export const requisitionsService = {
  getAll: (filters: RequisitionFilters = {}) =>
    apiClient.get<PaginatedResponse<Requisition>>(`/api/ap/requisitions?${buildParams(filters)}`).then(r => r.data),
  getOne: (id: string) =>
    apiClient.get<Requisition>(`/api/ap/requisitions/${id}`).then(r => r.data),
  create: (data: Partial<Requisition> & { items: Partial<RequisitionItem>[] }) =>
    apiClient.post<Requisition>('/api/ap/requisitions', data).then(r => r.data),
  update: (id: string, data: Partial<Requisition>) =>
    apiClient.put<Requisition>(`/api/ap/requisitions/${id}`, data).then(r => r.data),
  // was: PATCH /:id/submit (404) — now routed through the real /status endpoint
  submit: (id: string) => transitionRequisitionStatus(id, 'pending_approval'),
  // was: PATCH /:id/approve (404)
  approve: (id: string, approved_by = 'Manager') =>
    transitionRequisitionStatus(id, 'approved', { approved_by }),
  // was: PATCH /:id/reject (404)
  reject: (id: string, rejection_reason: string) =>
    transitionRequisitionStatus(id, 'rejected', { rejection_reason }),
  delete: (id: string) =>
    apiClient.delete(`/api/ap/requisitions/${id}`).then(r => r.data),
};

// ── RFP ────────────────────────────────────────────────────────────────

export interface RFPFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface EvaluateRfpPayload {
  selected_quote_id: string;
  evaluations: {
    vendor_quote_id: string;
    score?: number;
    price_score?: number;
    quality_score?: number;
    lead_time_score?: number;
    notes?: string;
  }[];
}

export const rfpService = {
  getAll: (filters: RFPFilters = {}) =>
    apiClient.get<PaginatedResponse<RFP>>(`/api/ap/rfp?${buildParams(filters)}`).then(r => r.data),
  getOne: (id: string) =>
    apiClient.get<RFP>(`/api/ap/rfp/${id}`).then(r => r.data),
  create: (data: { requisition_id: string; title: string; description?: string; deadline?: string }) =>
    apiClient.post<RFP>('/api/ap/rfp', data).then(r => r.data),
  update: (id: string, data: Partial<RFP>) =>
    apiClient.put<RFP>(`/api/ap/rfp/${id}`, data).then(r => r.data),
  // Submission only — no backend endpoint to edit a single submitted quote.
  // addQuote() upserts by (rfp_id, vendor_id) server-side, so call addQuote
  // again with the same vendor_id to revise a quote.
  addQuote: (rfp_id: string, data: Partial<VendorQuote>) =>
    apiClient.post<RFP>(`/api/ap/rfp/${rfp_id}/quotes`, data).then(r => r.data),
  // was: PUT /:id/quotes/:quote_id (404) — removed, no such backend route.
  // Evaluation + vendor selection happen together server-side via this one
  // endpoint. There is no separate /select-vendor route.
  evaluate: (rfp_id: string, data: EvaluateRfpPayload) =>
    apiClient.post<RFP>(`/api/ap/rfp/${rfp_id}/evaluate`, data).then(r => r.data),
  // was: PATCH /:id/select-vendor (404) — convenience wrapper around /evaluate
  selectVendor: (rfp_id: string, selected_quote_id: string) =>
    apiClient
      .post<RFP>(`/api/ap/rfp/${rfp_id}/evaluate`, {
        selected_quote_id,
        evaluations: [{ vendor_quote_id: selected_quote_id }],
      })
      .then(r => r.data),
};

// ── Purchase Orders ────────────────────────────────────────────────────

export interface POFilters {
  status?: string;
  vendor_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Raw tax line as entered by the user — matches poItemSchema on the backend.
// NOT the same as TaxLine (which includes computed tax_amount, only known after the backend prices the item).
export interface POItemCreateInput {
  item_id?: string;
  description: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  tax_lines: { name: string; percent: number }[];
  sort_order?: number;
}

export const purchaseOrdersService = {
  getAll: (filters: POFilters = {}) =>
    apiClient.get<PaginatedResponse<PurchaseOrder>>(`/api/ap/purchase-orders?${buildParams(filters)}`).then(r => r.data),
  getOne: (id: string) =>
    apiClient.get<PurchaseOrder>(`/api/ap/purchase-orders/${id}`).then(r => r.data),
  create: (data: Partial<Omit<PurchaseOrder, 'items'>> & { items: POItemCreateInput[] }) =>
    apiClient.post<PurchaseOrder>('/api/ap/purchase-orders', data).then(r => r.data),
  update: (id: string, data: Partial<PurchaseOrder>) =>
    apiClient.put<PurchaseOrder>(`/api/ap/purchase-orders/${id}`, data).then(r => r.data),
  // was PATCH — backend route is POST /:id/issue
  issue: (id: string) =>
    apiClient.post<PurchaseOrder>(`/api/ap/purchase-orders/${id}/issue`).then(r => r.data),
  // was PATCH — backend route is POST /:id/cancel
  cancel: (id: string) =>
    apiClient.post<PurchaseOrder>(`/api/ap/purchase-orders/${id}/cancel`).then(r => r.data),
  // Amendments — append only, no direct PO edits after issue
  createAmendment: (id: string, data: { reason: string; changes: POAmendment['changes'] }) =>
    apiClient.post<POAmendment>(`/api/ap/purchase-orders/${id}/amendments`, data).then(r => r.data),
  getAmendments: (id: string) =>
    apiClient.get<POAmendment[]>(`/api/ap/purchase-orders/${id}/amendments`).then(r => r.data),
};


// ── GRN ────────────────────────────────────────────────────────────────

export interface GRNFilters {
  status?: string;
  po_id?: string;
  page?: number;
  limit?: number;
}

export const grnService = {
  getAll: (filters: GRNFilters = {}) =>
    apiClient.get<PaginatedResponse<GRN>>(`/api/ap/grn?${buildParams(filters)}`).then(r => r.data),
  getOne: (id: string) =>
    apiClient.get<GRN>(`/api/ap/grn/${id}`).then(r => r.data),
  create: (data: { po_id: string; received_by?: string; notes?: string; items: Partial<GRNItem>[] }) =>
    apiClient.post<GRN>('/api/ap/grn', data).then(r => r.data),
  // NOTE: backend has no GRN update route (GRN is create-then-confirm only).
  // Left out deliberately rather than pointed at a route that doesn't exist —
  // if line-item correction before confirm is needed, that's a backend gap
  // to raise, not something to paper over here.
  // GRNStatus is draft → confirmed (matches schema.prisma exactly)
  confirm: (id: string) =>
    apiClient.patch<GRN>(`/api/ap/grn/${id}/confirm`).then(r => r.data),
};

// ── Vendor Invoices ────────────────────────────────────────────────────

export interface VendorInvoiceFilters {
  status?: string;
  vendor_id?: string;
  po_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface VendorInvoiceItemCreateInput {
  po_item_id: string;
  description: string;
  hsn_sac?: string;
  quantity_billed: number;
  unit_price: number;
  tax_lines: { name: string; percent: number }[];
  sort_order?: number;
}

export const vendorInvoicesService = {
  getAll: (filters: VendorInvoiceFilters = {}) =>
    apiClient.get<PaginatedResponse<VendorInvoice>>(`/api/ap/vendor-invoices?${buildParams(filters)}`).then(r => r.data),
  getOne: (id: string) =>
    apiClient.get<VendorInvoice>(`/api/ap/vendor-invoices/${id}`).then(r => r.data),
  create: (data: Partial<Omit<VendorInvoice, 'items'>> & { grn_id: string; items: VendorInvoiceItemCreateInput[] }) =>
    apiClient.post<VendorInvoice>('/api/ap/vendor-invoices', data).then(r => r.data),
  update: (id: string, data: Partial<VendorInvoice>) =>
    apiClient.put<VendorInvoice>(`/api/ap/vendor-invoices/${id}`, data).then(r => r.data),
  // was PATCH — backend route is POST /:id/submit
  submit: (id: string) =>
    apiClient.post<VendorInvoice>(`/api/ap/vendor-invoices/${id}/submit`).then(r => r.data),
  // Runs the 3-way match — separate explicit step between submit and approve
  runMatch: (id: string) =>
    apiClient.post<MatchResultPayload>(`/api/ap/vendor-invoices/${id}/match`).then(r => r.data),
  // was PATCH — backend route is POST /:id/approve
  approve: (id: string, approved_by = 'Finance') =>
    apiClient.post<VendorInvoice>(`/api/ap/vendor-invoices/${id}/approve`, { approved_by }).then(r => r.data),
  // was: PATCH /:id/reject (404) and PATCH /:id/void (404) — backend only
  // has POST /:id/cancel, which moves status to `void` (schema has no
  // separate VendorInvoiceStatus.cancelled or .rejected). Both collapse to this one real endpoint.
  cancel: (id: string) =>
    apiClient.post<VendorInvoice>(`/api/ap/vendor-invoices/${id}/cancel`).then(r => r.data),
  delete: (id: string) =>
    apiClient.delete(`/api/ap/vendor-invoices/${id}`).then(r => r.data),
};

// ── Match ──────────────────────────────────────────────────────────────

export const matchService = {
  getResult: (vendor_invoice_id: string) =>
    apiClient.get<MatchResultPayload>(`/api/ap/match/${vendor_invoice_id}`).then(r => r.data),
  run: (vendor_invoice_id: string) =>
    apiClient.post<MatchResultPayload>(`/api/ap/match/${vendor_invoice_id}/run`).then(r => r.data),
};

// ── Disputes ───────────────────────────────────────────────────────────

export interface DisputeFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface ResolveDisputePayload {
  // matches DisputeStatus in schema.prisma — there is no plain 'resolved' value
  resolution_action: 'accept_invoice' | 'amend_po' | 'reject_invoice';
  resolution: string;
  resolved_by?: string;
}

export const disputesService = {
  getAll: (filters: DisputeFilters = {}) =>
    apiClient.get<PaginatedResponse<DisputeRecord>>(`/api/ap/disputes?${buildParams(filters)}`).then(r => r.data),
  getOne: (id: string) =>
    apiClient.get<DisputeRecord>(`/api/ap/disputes/${id}`).then(r => r.data),
  getForInvoice: (vendor_invoice_id: string) =>
    apiClient.get<PaginatedResponse<DisputeRecord>>(`/api/ap/disputes?${buildParams({ vendor_invoice_id })}`).then(r => r.data),
  create: (data: {
    vendor_invoice_id: string;
    raised_by?: string;
    reason: string;
    // matches DisputeParty in schema.prisma — 'unknown' is not a valid value
    responsible_party: 'vendor' | 'internal' | 'purchase_order';
  }) =>
    apiClient.post<DisputeRecord>('/api/ap/disputes', data).then(r => r.data),
  // was PATCH — backend route is POST /:id/resolve.
  // was also sending { status, resolution_notes } — backend expects
  // { resolution_action, resolution, resolved_by? }
  resolve: (id: string, data: ResolveDisputePayload) =>
    apiClient.post<DisputeRecord>(`/api/ap/disputes/${id}/resolve`, data).then(r => r.data),
};

// ── Vendor Payments ────────────────────────────────────────────────────

export interface VendorPaymentFilters {
  vendor_invoice_id?: string;
  vendor_id?: string;
  page?: number;
  limit?: number;
}

export const vendorPaymentsService = {
  getAll: (filters: VendorPaymentFilters = {}) =>
    apiClient.get<PaginatedResponse<VendorPayment>>(`/api/ap/vendor-payments?${buildParams(filters)}`).then(r => r.data),
  create: (data: {
    vendor_invoice_id: string;
    amount: number;
    method: VendorPayment['method'];
    paid_at?: string;
    payment_ref?: string;
    notes?: string;
  }) =>
    apiClient.post<VendorPayment>('/api/ap/vendor-payments', data).then(r => r.data),
};

// ── Workflow status (sidebar unlock logic) ────────────────────────────
// Not present in the file you shared, kept from the prior foundation batch —
// remove this block if GET /api/ap/workflow-status doesn't actually exist
// on your backend; useWorkflowStatus() falls back gracefully either way.

export const workflowService = {
  getStatus: () => apiClient.get('/api/ap/workflow-status').then(r => r.data),
};