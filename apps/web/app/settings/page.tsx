'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { companyService } from '@/services/ar';
import { CompanyConfig } from '../../types/ar';

// PLACE AT: apps/web/app/settings/page.tsx
// Singleton config — GET /api/company-settings, PUT upserts (creates on
// first save if nothing exists yet, updates thereafter). Route path is
// UNVERIFIED — see the note in services/ar/index.ts.
// Field names corrected to match the real CompanyConfig type exactly:
// `name` (not business_name), `account_number`/`ifsc_code`/`branch`
// (not bank_account_number/bank_ifsc/bank_branch).

const emptyForm: CompanyConfig = {
  name: '', address: '', email: '', phone: '', logo_url: '',
  gstin: '', pan: '', bank_name: '', account_number: '', ifsc_code: '', branch: '',
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

export default function SettingsPage() {
  const [form, setForm] = useState<CompanyConfig>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await companyService.get();
        setForm({ ...emptyForm, ...data });
      } catch {
        // No config saved yet — expected on a fresh install, not an error.
        setIsNew(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set<K extends keyof CompanyConfig>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Business name is required'); return; }
    setSaving(true);
    try {
      const saved = await companyService.update(form);
      setForm({ ...emptyForm, ...saved });
      setIsNew(false);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Settings</h1>
      <p className="text-sm text-slate-400 mb-6">
        {isNew ? 'No company profile saved yet — fill this in once, it applies to every invoice and PO.' : 'Business identity and bank details used on every document.'}
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Business Identity</h2>
          <div className="space-y-4">
            <Field label="Business Name *">
              <input required className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>
            <Field label="Address">
              <input className={inputCls} value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input type="email" className={inputCls} value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className={inputCls} value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
              </Field>
            </div>
            <Field label="Logo URL">
              <input className={inputCls} value={form.logo_url ?? ''} onChange={e => set('logo_url', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="GSTIN">
                <input className={inputCls} value={form.gstin ?? ''} onChange={e => set('gstin', e.target.value.toUpperCase())} />
              </Field>
              <Field label="PAN">
                <input className={inputCls} value={form.pan ?? ''} onChange={e => set('pan', e.target.value.toUpperCase())} />
              </Field>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 pt-4">Bank Details</h2>
          <div className="space-y-4">
            <Field label="Bank Name">
              <input className={inputCls} value={form.bank_name ?? ''} onChange={e => set('bank_name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Account Number">
                <input className={inputCls} value={form.account_number ?? ''} onChange={e => set('account_number', e.target.value)} />
              </Field>
              <Field label="IFSC Code">
                <input className={inputCls} value={form.ifsc_code ?? ''} onChange={e => set('ifsc_code', e.target.value.toUpperCase())} />
              </Field>
            </div>
            <Field label="Branch">
              <input className={inputCls} value={form.branch ?? ''} onChange={e => set('branch', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}