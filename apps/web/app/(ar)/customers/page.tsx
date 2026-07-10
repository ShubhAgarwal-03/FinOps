'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { customersService } from '../../../lib/api/ar/index';
import { Customer } from '@/types/ar';
import { Loader2, Users, Plus, Pencil, Trash2, X, BookOpen } from 'lucide-react';

// PLACE AT: apps/web/app/(app)/customers/page.tsx
// Ported from the real original — same modal create/edit pattern (no
// separate /customers/new route), just re-containered to match the rest
// of the FinOps app (`max-w-* mx-auto py-8 px-4` instead of the original's
// own full-bleed bg-slate-50 header bar, since the root layout now owns
// the page shell).

const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' }, { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹' }, { code: 'USD', symbol: '$' }, { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' }, { code: 'SGD', symbol: 'S$' }, { code: 'AED', symbol: 'AED' },
  { code: 'AUD', symbol: 'A$' }, { code: 'CAD', symbol: 'C$' }, { code: 'JPY', symbol: '¥' },
];

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR',
  AU: 'AUD', CA: 'CAD', JP: 'JPY', SG: 'SGD', AE: 'AED',
};

const emptyForm: Omit<Customer, 'id' | 'is_deleted' | 'created_at' | 'updated_at'> = {
  customer_code: '', customer_type: 'business', customer_name: '', company_name: '',
  email: '', phone: '', address: '', billing_address_1: '', billing_address_2: '',
  city: '', state: '', postal_code: '', country: 'IN', currency: 'INR',
  gstin: '', pan: '', registration_number: '',
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currencyManuallySet, setCurrencyManuallySet] = useState(false);

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    try {
      setCustomers(await customersService.getAll());
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm); setEditingId(null); setErrors({}); setCurrencyManuallySet(false); setShowModal(true);
  }

  function openEdit(c: Customer) {
    setForm({
      customer_code: c.customer_code ?? '', customer_type: c.customer_type, customer_name: c.customer_name,
      company_name: c.company_name ?? '', email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '',
      billing_address_1: c.billing_address_1 ?? '', billing_address_2: c.billing_address_2 ?? '',
      city: c.city ?? '', state: c.state ?? '', postal_code: c.postal_code ?? '',
      country: c.country, currency: c.currency, gstin: c.gstin ?? '', pan: c.pan ?? '',
      registration_number: c.registration_number ?? '',
    });
    setEditingId(c.id); setErrors({}); setCurrencyManuallySet(true); setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.customer_name.trim()) e.customer_name = 'Contact name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.country) e.country = 'Country is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { toast.error('Please fix the errors before saving.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await customersService.update(editingId, form);
        setCustomers(prev => prev.map(c => c.id === editingId ? updated : c));
        toast.success('Customer saved.');
      } else {
        const created = await customersService.create(form);
        setCustomers(prev => [created, ...prev]);
        toast.success('Customer created.');
      }
      setShowModal(false);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await customersService.delete(id);
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast.success('Customer deleted.');
      setDeleteId(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (name === 'currency') {
      setCurrencyManuallySet(true);
      setForm(prev => ({ ...prev, currency: value }));
    } else if (name === 'country') {
      const derived = COUNTRY_CURRENCY[value];
      setForm(prev => ({ ...prev, country: value, ...((!currencyManuallySet && derived) ? { currency: derived } : {}) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }

  const inputClass = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';
  const errorClass = 'text-red-500 text-xs mt-1';
  const labelClass = 'text-xs font-bold text-slate-600 uppercase';

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
            <p className="text-sm text-slate-400">{customers.length} total</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
          <Plus className="w-4 h-4" /> New Customer
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-16 text-slate-400">
          <Users className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium text-slate-500">No customers yet.</p>
          <p className="text-xs mb-4">Add your first customer to get started.</p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
            Add Customer
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                {['Name', 'Company', 'Email', 'Phone', 'Country', 'Currency', 'GSTIN', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.customer_name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.company_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.country}</td>
                  <td className="px-4 py-3 text-slate-500">{c.currency}</td>
                  <td className="px-4 py-3 text-slate-500">{c.gstin || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 cursor-pointer" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => router.push(`/customers/${c.id}/ledger`)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 cursor-pointer" title="View Ledger">
                        <BookOpen className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 cursor-pointer" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Customer' : 'New Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Customer Type</label>
                  <select name="customer_type" value={form.customer_type} onChange={handleChange} className={`${inputClass} mt-1`}>
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Customer Code</label>
                  <input name="customer_code" value={form.customer_code ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} placeholder="e.g. CUST-001" />
                </div>
                <div>
                  <label className={labelClass}>Contact Name *</label>
                  <input name="customer_name" value={form.customer_name} onChange={handleChange} className={`${inputClass} mt-1`} required />
                  {errors.customer_name && <p className={errorClass}>{errors.customer_name}</p>}
                </div>
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input name="company_name" value={form.company_name ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input name="email" type="email" value={form.email ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                  {errors.email && <p className={errorClass}>{errors.email}</p>}
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input name="phone" value={form.phone ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} />
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <select name="currency" value={form.currency} onChange={handleChange} className={`${inputClass} mt-1`}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-bold text-slate-700 mb-4">Billing Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><input name="billing_address_1" value={form.billing_address_1 ?? ''} onChange={handleChange} placeholder="Address Line 1" className={inputClass} /></div>
                  <div className="col-span-2"><input name="billing_address_2" value={form.billing_address_2 ?? ''} onChange={handleChange} placeholder="Address Line 2" className={inputClass} /></div>
                  <div><input name="city" value={form.city ?? ''} onChange={handleChange} placeholder="City" className={inputClass} /></div>
                  <div><input name="state" value={form.state ?? ''} onChange={handleChange} placeholder="State / Province" className={inputClass} /></div>
                  <div><input name="postal_code" value={form.postal_code ?? ''} onChange={handleChange} placeholder="Postal Code" className={inputClass} /></div>
                  <div>
                    <select name="country" value={form.country} onChange={handleChange} className={inputClass}>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    {errors.country && <p className={errorClass}>{errors.country}</p>}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-bold text-slate-700 mb-4">Tax Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>GSTIN / Tax ID</label><input name="gstin" value={form.gstin ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} /></div>
                  <div><label className={labelClass}>PAN</label><input name="pan" value={form.pan ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} /></div>
                  <div><label className={labelClass}>Registration No.</label><input name="registration_number" value={form.registration_number ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} /></div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 flex items-center gap-2 cursor-pointer disabled:opacity-60">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Customer?</h3>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}