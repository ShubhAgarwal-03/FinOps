import { Prisma, CustomerType } from '@prisma/client';
import { prisma } from '../../../apps/api/src/config/prisma';
import { getCurrencyForCountry } from '../../shared/utils/currency.utils';

export interface CreateCustomerInput {
  customer_code?: string;
  customer_type?: CustomerType;
  customer_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  gstin?: string;
  pan?: string;
  registration_number?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email?: string) {
  if (email && !EMAIL_REGEX.test(email)) {
    throw Object.assign(new Error('Invalid email format'), { statusCode: 400 });
  }
}

export async function listCustomers() {
  return prisma.customer.findMany({
    where: { is_deleted: false },
    orderBy: { created_at: 'desc' },
  });
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, is_deleted: false },
  });
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  return customer;
}

export async function createCustomer(input: CreateCustomerInput) {
  if (!input.customer_name || !input.country) {
    throw Object.assign(
      new Error('customer_name and country are required'),
      { statusCode: 400 }
    );
  }
  validateEmail(input.email);

  const currency = getCurrencyForCountry(input.country);

  return prisma.customer.create({
    data: { ...input, currency },
  });
}

export async function updateCustomer(id: string, input: Partial<CreateCustomerInput>) {
  validateEmail(input.email);

  const updates: Prisma.CustomerUpdateInput = { ...input };
  if (input.country) updates.currency = getCurrencyForCountry(input.country);

  const customer = await prisma.customer.findFirst({ where: { id, is_deleted: false } });
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  return prisma.customer.update({
    where: { id },
    data: updates,
  });
}

export async function softDeleteCustomer(id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, is_deleted: false } });
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  return prisma.customer.update({
    where: { id },
    data: { is_deleted: true, deleted_at: new Date() },
  });
}