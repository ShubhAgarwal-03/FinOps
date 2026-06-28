'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { purchaseOrdersService, rfpService } from '@/services/ap';
import VendorPicker from '@/components/ap/VendorPicker';
import type { Vendor, RFP } from '@/types/ap';

const emptyItem = () => ({ description: '', hsn_sac: '', quantity: '1', unit_price: '', sort_order: 0 });
const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

export default function NewPOPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rfpId = searchParams.get('rfp_id');

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [form, setForm] = useState({
    notes: '', payment_terms: '', delivery_address: '', expected_delivery: '',
    discount_percent: '0', is_interstate: false,
  });
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  // Pre-populate from RFP if coming from evaluate page
  useEffect(() => {
    if (!rfpId) return;
    rfpService.getOne(rfpId).then(r => {
      setRfp(r);
      const selectedEval = r.quote_evaluations?.find((e: { is_selected: boolean }) => e.is_selected);
      const selectedQuote = r.vendor_quotes?.find((q: { id: string }) => q.id === selectedEval?.vendor_quote_id);
      if (selectedQuote) {
        setItems([{
          description: `Items from RFP ${r.rfp_number}`,
          hsn_sac: '',
          quantity: '1',
          unit_price: String(selectedQuote.unit_price),
          sort_order: 0,
        }]);
      }
    }).catch(() => {});
  }, [rfpId]);

  function setField(field: string, value: string | boolean) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function updateItem(i: number, field: string, value: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  }

  function addItem() { setItems(p => [...p, emptyItem()]); }
  function removeItem(i: number) { if (items.length > 1) setItems(p => p.filter((_, idx) => idx !== i)); }

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 0), 0);
  const discount = subtotal * (parseFloat(form.discount_percent) || 0) / 100;
  const total = subtotal - discount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendor) { toast.error('Select a vendor'); return; }
    if (items.some(it => !it.description || !it.unit_price)) { toast.error('All items need a description and price'); return; }
    setSaving(true);
    try {
      const po = await purchaseOrdersService.create({
        vendor_id: vendor.id,
        rfp_id: rfpId ?? undefined,
        notes: form.notes || undefined,
        payment_terms: form.payment_terms || undefined,
        delivery_address: form.delivery_address || undefined,
        expected_delivery: form.expected_delivery || undefined,
        discount_percent: parseFloat(form.discount_percent) || 0,
        is_interstate: form.is_interstate,
        items: items.map((it, i) => ({
          description: it.description,
          hsn_sac: it.hsn_sac || undefined,
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          tax_lines: [],
          sort_order: i,
        })),
      });
      toast.success(`Purchase Order ${po.po_number} created.`);
      router.push(`/purchase-orders/${po.id}`);
    } catch {
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Purchase Order</h1>
        {rfp && <p className="text-sm text-slate-500 mt-1">From RFP: {rfp.rfp_number} — {rfp.title}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Vendor</h2>
          <VendorPicker value={vendor?.id ?? ''} onChange={setVendor} />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="interstate" checked={form.is_interstate} onChange={e => setField('is_interstate', e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="interstate" className="text-sm text-slate-700">Interstate supply (IGST applies)</label>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">Order Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Payment Terms</label>
              <input value={form.payment_terms} onChange={e => setField('payment_terms', e.target.value)} className={inputClass} placeholder="e.g. Net 30" />
            </div>
            <div>
              <label className={labelClass}>Expected Delivery</label>
              <input type="date" value={form.expected_delivery} onChange={e => setField('expected_delivery', e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Delivery Address</label>
              <input value={form.delivery_address} onChange={e => setField('delivery_address', e.target.value)} className={inputClass} placeholder="Where should goods be delivered?" />
            </div>
            <div>
              <label className={labelClass}>Discount %</label>
              <input type="number" min="0" max="100" step="0.01" value={form.discount_percent} onChange={e => setField('discount_percent', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input value={form.notes} onChange={e => setField('notes', e.target.value)} className={inputClass} placeholder="Internal notes…" />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Line Items</h2>
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
                    <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 cursor-pointer"><Trash2 size={14} /></button>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Description *</label>
                  <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className={inputClass} placeholder="Item description" required />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>HSN / SAC</label>
                    <input value={item.hsn_sac} onChange={e => updateItem(i, 'hsn_sac', e.target.value)} className={inputClass} placeholder="8471" />
                  </div>
                  <div>
                    <label className={labelClass}>Quantity *</label>
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Unit Price *</label>
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} className={inputClass} placeholder="0.00" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <div className="space-y-1 text-sm min-w-[200px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount ({form.discount_percent}%)</span>
                  <span>−₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create Purchase Order
          </button>
        </div>
      </form>
    </div>
  );
}