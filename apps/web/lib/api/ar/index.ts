// ──────────────────────────────────────────────────────────────────────────

import apiClient from '@/services/apiClient';
import type {
  Customer, Item, SalesInvoice, InvoiceListResponse, InvoiceStatus,
  Payment, PaymentMethod, LedgerResponse, CompanyConfig,
} from '@/types/ar';

// ── Customers ──────────────────────────────────────────────────────────

export const customersService = {
  getAll: () => apiClient.get<Customer[]>('/api/ar/customers').then(r => r.data),
  getOne: (id: string) => apiClient.get<Customer>(`/api/ar/customers/${id}`).then(r => r.data),
  create: (data: Partial<Customer>) => apiClient.post<Customer>('/api/ar/customers', data).then(r => r.data),
  update: (id: string, data: Partial<Customer>) => apiClient.put<Customer>(`/api/ar/customers/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/ar/customers/${id}`).then(r => r.data),
  getLedger: (id: string) => apiClient.get<LedgerResponse>(`/api/ar/customers/${id}/ledger`).then(r => r.data),
  getStatementPdfUrl: (id: string): string =>
    `${apiClient.defaults.baseURL ?? ''}/api/ar/customers/${id}/statement/pdf`,
};

// ── Catalogue Items — UNVERIFIED route, see file header ─────────────────

export const itemsService = {
  getAll: () => apiClient.get<Item[]>('/api/catalogue/items').then(r => r.data),
  create: (data: Partial<Item>) => apiClient.post<Item>('/api/catalogue/items', data).then(r => r.data),
  update: (id: string, data: Partial<Item>) => apiClient.put<Item>(`/api/catalogue/items/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/api/catalogue/items/${id}`).then(r => r.data),
};

// ── Sales Invoices ─────────────────────────────────────────────────────

export interface InvoiceFilters {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const invoicesService = {
  getAll: (filters: InvoiceFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v));
    });
    return apiClient.get<InvoiceListResponse>(`/api/ar/invoices?${params}`).then(r => r.data);
  },
  getOne: (id: string) => apiClient.get<SalesInvoice>(`/api/ar/invoices/${id}`).then(r => r.data),
  // Re-snapshots customer data server-side on save, per project-summary.md
  create: (data: Partial<SalesInvoice>) => apiClient.post<SalesInvoice>('/api/ar/invoices', data).then(r => r.data),
  update: (id: string, data: Partial<SalesInvoice>) => apiClient.put<SalesInvoice>(`/api/ar/invoices/${id}`, data).then(r => r.data),
  // Workflow status only (draft -> sent -> paid) — separate from payment_status,
  // which the backend derives from recorded payments.
  updateStatus: (id: string, status: InvoiceStatus) =>
    apiClient.patch<SalesInvoice>(`/api/ar/invoices/${id}/status`, { status }).then(r => r.data),
  duplicate: (id: string) => apiClient.post<SalesInvoice>(`/api/ar/invoices/${id}/duplicate`).then(r => r.data),
  // Soft delete — is_deleted flag, never hard-deleted
  delete: (id: string) => apiClient.delete(`/api/ar/invoices/${id}`).then(r => r.data),
  getPdfUrl: (id: string): string => `${apiClient.defaults.baseURL ?? ''}/api/ar/invoices/${id}/pdf`,
};

// ── Payments ───────────────────────────────────────────────────────────

export interface RecordPaymentPayload {
  amount: number;
  method: PaymentMethod;
  paid_at?: string;
  notes?: string;
}

export const paymentsService = {
  getForInvoice: (invoiceId: string) =>
    apiClient.get<Payment[]>(`/api/ar/invoices/${invoiceId}/payments`).then(r => r.data),
  // Returns both the created payment AND the updated invoice (with
  // recalculated amount_paid/balance_due/payment_status) in one round trip.
  record: (invoiceId: string, payload: RecordPaymentPayload) =>
    apiClient
      .post<{ payment: Payment; invoice: SalesInvoice }>(`/api/ar/invoices/${invoiceId}/payments`, payload)
      .then(r => r.data),
};

// ── Company Settings — UNVERIFIED route, see services/ap note pattern ──

export const companyService = {
  get: () => apiClient.get<CompanyConfig>('/api/company-settings').then(r => r.data),
  update: (data: Partial<CompanyConfig>) =>
    apiClient.put<CompanyConfig>('/api/company-settings', data).then(r => r.data),
};