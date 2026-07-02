import apiClient from './apiClient';
import { buildParams } from '@/lib/api/query-params';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';

export interface Invoice {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  payment_status: 'unpaid' | 'partial' | 'paid';
  issue_date: string;
  due_date?: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  customer_id: string;
  customer_snapshot: {
    customer_name?: string;
    company_name?: string;
    currency?: string;
    country?: string;
  };
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_lines: { name: string; percent: number; tax_amount: number }[];
  line_total: number;
  hsn_sac?: string;
  sort_order: number;
}

export interface InvoiceFilters {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const invoiceServices = {
  getAll: (filters: InvoiceFilters = {}) =>
    apiClient.get<{ invoices: Invoice[]; pagination: any }>(
      `/api/ar/invoices?${buildParams(filters)}`
    ).then(r => r.data),

  getOne: (id: string) =>
    apiClient.get<Invoice>(`/api/ar/invoices/${id}`).then(r => r.data),

  create: (data: any) =>
    apiClient.post<Invoice>('/api/ar/invoices', data).then(r => r.data),

  update: (id: string, data: any) =>
    apiClient.put<Invoice>(`/api/ar/invoices/${id}`, data).then(r => r.data),

  updateStatus: (id: string, status: InvoiceStatus) =>
    apiClient.patch<Invoice>(`/api/ar/invoices/${id}/status`, { status }).then(r => r.data),

  duplicate: (id: string) =>
    apiClient.post<Invoice>(`/api/ar/invoices/${id}/duplicate`).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/api/ar/invoices/${id}`).then(r => r.data),

  downloadPdf: (id: string) =>
    apiClient.get(`/api/ar/invoices/${id}/pdf`, { responseType: 'blob' }).then(r => r.data),
};