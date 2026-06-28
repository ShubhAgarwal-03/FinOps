'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { requisitionsService } from '@/services/ap';

const emptyItem = () => ({
  description: '',
  quantity: '1',
  unit_of_measure: '',
  estimated_unit_price: '',
  notes: '',
});

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

export default function NewRequisitionPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    requested_by: '',
    required_by: '',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  function setField(field: string, value: string) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function updateItem(index: number, field: string, value: string) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }

  function addItem() { setItems(p => [...p, emptyItem()]); }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems(p => p.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (items.some(it => !it.description.trim())) { toast.error('All items need a description'); return; }
    setSaving(true);
    try {
      const req = await requisitionsService.create({
        title: form.title,
        description: form.description || undefined,
        requested_by: form.requested_by || undefined,
        required_by: form.required_by || undefined,
        items: items.map((it, i) => ({
          description: it.description,
          quantity: parseFloat(it.quantity) || 1,
          unit_of_measure: it.unit_of_measure || undefined,
          estimated_unit_price: it.estimated_unit_price ? parseFloat(it.estimated_unit_price) : undefined,
          notes: it.notes || undefined,
          sort_order: i,
        })),
      });
      toast.success(`Requisition ${req.req_number} created.`);
      router.push(`/requisitions/${req.id}`);
    } catch {
      toast.error('Failed to create requisition');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Raise Requisition</h1>
        <p className="text-sm text-slate-500 mt-1">Specify what you need and quantity required. This will be sent for manager approval.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Requisition Details</h2>
          <div>
            <label className={labelClass}>Title *</label>
            <input value={form.title} onChange={e => setField('title', e.target.value)} className={inputClass} placeholder="e.g. Office Chairs — Q3 Procurement" required />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={2} value={form.description} onChange={e => setField('description', e.target.value)} className={inputClass} placeholder="Additional context or justification…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Requested By</label>
              <input value={form.requested_by} onChange={e => setField('requested_by', e.target.value)} className={inputClass} placeholder="Your name" />
            </div>
            <div>
              <label className={labelClass}>Required By</label>
              <input type="date" value={form.required_by} onChange={e => setField('required_by', e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Items Needed</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item, i) => (
              <div key={i} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Description *</label>
                  <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className={inputClass} placeholder="What do you need?" required />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Quantity *</label>
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Unit of Measure</label>
                    <input value={item.unit_of_measure} onChange={e => updateItem(i, 'unit_of_measure', e.target.value)} className={inputClass} placeholder="e.g. pcs, kg" />
                  </div>
                  <div>
                    <label className={labelClass}>Est. Unit Price</label>
                    <input type="number" min="0" step="0.01" value={item.estimated_unit_price} onChange={e => updateItem(i, 'estimated_unit_price', e.target.value)} className={inputClass} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <input value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)} className={inputClass} placeholder="Any specific requirements…" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Submit for Approval
          </button>
        </div>
      </form>
    </div>
  );
}