'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { vendorsService } from '@/services/ap';
import type { Vendor } from '@/types/ap';

const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
  { code: 'AU', name: 'Australia' }, { code: 'CA', name: 'Canada' },
];

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'SGD', name: 'Singapore Dollar (S$)' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
];

type VendorForm = {
  vendor_name: string;
  company_name: string;
  email: string;
  phone: string;
  billing_address_1: string;
  billing_address_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  currency: string;
  gstin: string;
  pan: string;
  payment_terms: string;
};

const defaultForm: VendorForm = {
  vendor_name: '', company_name: '', email: '', phone: '',
  billing_address_1: '', billing_address_2: '', city: '', state: '',
  postal_code: '', country: 'IN', currency: 'INR',
  gstin: '', pan: '', payment_terms: '',
};

interface Props {
  vendor?: Vendor;
}

export default function VendorForm({ vendor }: Props) {
  const router = useRouter();
  const isEdit = !!vendor;

  const [form, setForm] = useState<VendorForm>(
    vendor ? {
      vendor_name: vendor.vendor_name,
      company_name: vendor.company_name ?? '',
      email: vendor.email ?? '',
      phone: vendor.phone ?? '',
      billing_address_1: vendor.billing_address_1 ?? '',
      billing_address_2: vendor.billing_address_2 ?? '',
      city: vendor.city ?? '',
      state: vendor.state ?? '',
      postal_code: vendor.postal_code ?? '',
      country: vendor.country,
      currency: vendor.currency,
      gstin: vendor.gstin ?? '',
      pan: vendor.pan ?? '',
      payment_terms: vendor.payment_terms ?? '',
    } : defaultForm
  );

  const [saving, setSaving] = useState(false);

  const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
  const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

  function set(field: keyof VendorForm, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendor_name.trim()) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await vendorsService.update(vendor!.id, form);
        toast.success('Vendor updated.');
        router.push(`/vendors/${vendor!.id}`);
      } else {
        const created = await vendorsService.create(form);
        toast.success('Vendor created.');
        router.push(`/vendors/${created.id}`);
      }
    } catch {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} vendor`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Vendor' : 'New Vendor'}</h1>
        <p className="text-sm text-slate-500 mt-1">{isEdit ? 'Update vendor details.' : 'Add a vendor to your procurement network.'}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Vendor Name *</label>
              <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className={inputClass} placeholder="e.g. Acme Supplies" required />
            </div>
            <div>
              <label className={labelClass}>Company Name</label>
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className={inputClass} placeholder="Legal entity name" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputClass} placeholder="vendor@example.com" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputClass} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inputClass}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment Terms</label>
              <input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} className={inputClass} placeholder="e.g. Net 30" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Billing Address</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <input value={form.billing_address_1} onChange={e => set('billing_address_1', e.target.value)} className={inputClass} placeholder="Address Line 1" />
            </div>
            <div className="col-span-2">
              <input value={form.billing_address_2} onChange={e => set('billing_address_2', e.target.value)} className={inputClass} placeholder="Address Line 2" />
            </div>
            <div>
              <input value={form.city} onChange={e => set('city', e.target.value)} className={inputClass} placeholder="City" />
            </div>
            <div>
              <input value={form.state} onChange={e => set('state', e.target.value)} className={inputClass} placeholder="State / Province" />
            </div>
            <div>
              <input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} className={inputClass} placeholder="Postal Code" />
            </div>
            <div>
              <select value={form.country} onChange={e => set('country', e.target.value)} className={inputClass}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tax */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Tax Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>GSTIN</label>
              <input value={form.gstin} onChange={e => set('gstin', e.target.value)} className={inputClass} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <label className={labelClass}>PAN</label>
              <input value={form.pan} onChange={e => set('pan', e.target.value)} className={inputClass} placeholder="AAAAA0000A" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Vendor'}
          </button>
        </div>
      </form>
    </div>
  );
}