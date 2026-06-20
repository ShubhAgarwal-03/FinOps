import { Vendor, VendorStatus } from '@prisma/client';

export type { Vendor };

export interface CreateVendorDto {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  billing_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  notes?: string;
}

export interface UpdateVendorDto extends Partial<CreateVendorDto> {
  status?: VendorStatus;
}

export interface VendorListQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: VendorStatus;
}

export interface VendorSnapshot {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  billing_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  snapshot_at: string;
}
