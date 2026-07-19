'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { itemsService } from '../../../lib/api/ar/index';
import { Item } from '@/types/ar';
import { Loader2, Package, Plus, Pencil, Trash2, X } from 'lucide-react';

// PLACE AT: apps/web/app/(ar)/items/page.tsx
// Catalogue of reusable line items — shared by AR sales invoices and AP
// requisitions/POs/GRNs/vendor invoices (see prisma `Item` model). Mirrors
// the customers page's modal create/edit pattern for consistency across
// the AR section of the app.

const CURRENCIES = [
  { code: 'INR', symbol: '₹' }, { code: 'USD', symbol: '$' }, { code: 'GBP', symbol: '£' },
  { code: 'EUR', symbol: '€' }, { code: 'SGD', symbol: 'S$' }, { code: 'AED', symbol: 'AED' },
  { code: 'AUD', symbol: 'A$' }, { code: 'CAD', symbol: 'C$' }, { code: 'JPY', symbol: '¥' },
];

const emptyForm: Omit<Item, 'id' | 'is_deleted' | 'created_at' | 'updated_at'> = {
  name: '', description: '', unit_price: 0, tax_percent: 0,
  unit_of_measure: '', item_type: 'simple', currency: 'INR', hsn_sac: '',
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    try {
      setItems(await itemsService.getAll());
    } catch {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm); setEditingId(null); setErrors({}); setShowModal(true);
  }

  function openEdit(it: Item) {
    setForm({
      name: it.name, description: it.description ?? '', unit_price: Number(it.unit_price) || 0,
      tax_percent: Number(it.tax_percent) || 0, unit_of_measure: it.unit_of_measure ?? '',
      item_type: it.item_type ?? 'simple', currency: it.currency ?? 'INR', hsn_sac: it.hsn_sac ?? '',
    });
    setEditingId(it.id); setErrors({}); setShowModal(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Item name is required';
    if (form.unit_price < 0) e.unit_price = 'Unit price cannot be negative';
    if (form.tax_percent! < 0 || form.tax_percent! > 100) e.tax_percent = 'Tax % must be between 0 and 100';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { toast.error('Please fix the errors before saving.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await itemsService.update(editingId, form);
        setItems(prev => prev.map(it => it.id === editingId ? updated : it));
        toast.success('Item saved.');
      } else {
        const created = await itemsService.create(form);
        setItems(prev => [created, ...prev]);
        toast.success('Item created.');
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
      await itemsService.delete(id);
      setItems(prev => prev.filter(it => it.id !== id));
      toast.success('Item deleted.');
      setDeleteId(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    if (name === 'unit_price' || name === 'tax_percent') {
      setForm(prev => ({ ...prev, [name]: value === '' ? 0 : parseFloat(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }

  const inputClass = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';
  const errorClass = 'text-red-500 text-xs mt-1';
  const labelClass = 'text-xs font-bold text-slate-600 uppercase';

  function fmtPrice(it: Item) {
    const symbol = CURRENCIES.find(c => c.code === it.currency)?.symbol ?? it.currency ?? '';
    return `${symbol}${Number(it.unit_price).toFixed(2)}`;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Items</h1>
            <p className="text-sm text-slate-400">{items.length} total</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
          <Plus className="w-4 h-4" /> New Item
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-16 text-slate-400">
          <Package className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium text-slate-500">No items yet.</p>
          <p className="text-xs mb-4">Add items here to reuse them on invoices, requisitions and purchase orders.</p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer">
            Add Item
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                {['Name', 'HSN/SAC', 'Unit Price', 'Tax %', 'UoM', 'Type', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{it.name}</div>
                    {it.description && <div className="text-xs text-slate-400">{it.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{it.hsn_sac || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtPrice(it)}</td>
                  <td className="px-4 py-3 text-slate-500">{Number(it.tax_percent) || 0}%</td>
                  <td className="px-4 py-3 text-slate-500">{it.unit_of_measure || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{it.item_type || 'simple'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(it)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 cursor-pointer" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(it.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 cursor-pointer" title="Delete">
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
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Item' : 'New Item'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>Item Name *</label>
                  <input name="name" value={form.name} onChange={handleChange} className={`${inputClass} mt-1`} required />
                  {errors.name && <p className={errorClass}>{errors.name}</p>}
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea name="description" value={form.description ?? ''} onChange={handleChange} className={`${inputClass} mt-1 h-20 resize-none`} />
                </div>
                <div>
                  <label className={labelClass}>Item Type</label>
                  <select name="item_type" value={form.item_type} onChange={handleChange} className={`${inputClass} mt-1`}>
                    <option value="simple">Simple</option>
                    <option value="compound">Compound</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>HSN/SAC Code</label>
                  <input name="hsn_sac" value={form.hsn_sac ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} placeholder="e.g. 998314" />
                </div>
                <div>
                  <label className={labelClass}>Unit Price *</label>
                  <input name="unit_price" type="number" step="0.01" min="0" value={form.unit_price} onChange={handleChange} className={`${inputClass} mt-1`} />
                  {errors.unit_price && <p className={errorClass}>{errors.unit_price}</p>}
                </div>
                <div>
                  <label className={labelClass}>Currency</label>
                  <select name="currency" value={form.currency} onChange={handleChange} className={`${inputClass} mt-1`}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Tax %</label>
                  <input name="tax_percent" type="number" step="0.01" min="0" max="100" value={form.tax_percent} onChange={handleChange} className={`${inputClass} mt-1`} />
                  {errors.tax_percent && <p className={errorClass}>{errors.tax_percent}</p>}
                </div>
                <div>
                  <label className={labelClass}>Unit of Measure</label>
                  <input name="unit_of_measure" value={form.unit_of_measure ?? ''} onChange={handleChange} className={`${inputClass} mt-1`} placeholder="e.g. hrs, pcs, kg" />
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
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Item?</h3>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone. Items already used on past invoices or POs are unaffected.</p>
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