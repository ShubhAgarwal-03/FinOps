'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { vendorsService } from '@/services/ap';

// PLACE AT: apps/web/app/(ap)/vendors/new/page.tsx

const emptyForm = {
  vendor_name: '', company_name: '', email: '', phone: '',
  address: '', city: '', state: '', postal_code: '', country: 'India',
  currency: 'INR', gstin: '', pan: '', payment_terms: '',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200';

export default function NewVendorPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendor_name.trim()) { toast.error('Vendor name is required'); return; }
    setSaving(true);
    try {
      const vendor = await vendorsService.create(form);
      toast.success('Vendor created');
      router.push(`/vendors/${vendor.id}`);
    } catch {
      toast.error('Failed to create vendor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">New Vendor</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vendor Name *">
            <input required className={inputCls} value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} />
          </Field>
          <Field label="Company Name">
            <input className={inputCls} value={form.company_name} onChange={e => set('company_name', e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} />
          </Field>
        </div>

        <Field label="Address">
          <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="City">
            <input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} />
          </Field>
          <Field label="State">
            <input className={inputCls} value={form.state} onChange={e => set('state', e.target.value)} />
          </Field>
          <Field label="Postal Code">
            <input className={inputCls} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="GSTIN">
            <input className={inputCls} value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} />
          </Field>
          <Field label="PAN">
            <input className={inputCls} value={form.pan} onChange={e => set('pan', e.target.value.toUpperCase())} />
          </Field>
        </div>

        <Field label="Payment Terms">
          <input className={inputCls} placeholder="e.g. Net 30" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create Vendor
          </button>
        </div>
      </form>
    </div>
  );
}