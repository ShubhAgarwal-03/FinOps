'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { vendorInvoicesService, purchaseOrdersService } from '@/services/ap';
import type { PurchaseOrder } from '@/types/ap';

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

export default function NewVendorInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    vendor_ref_number: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    purchaseOrdersService.getAll({ status: 'issued', limit: 100 })
      .then(r => {
        setPos(r.data);
        if (poIdParam) {
          const po = r.data.find((p: PurchaseOrder) => p.id === poIdParam);
          if (po) loadPO(po);
        }
      }).catch(() => {});
  }, [poIdParam]);

  async function loadPO(po: PurchaseOrder) {
    try {
      const full = await purchaseOrdersService.getOne(po.id);
      setSelectedPO(full);
      const init: Record<string, string> = {};
      full.items.forEach(it => { init[it.id] = String(it.quantity); });
      setQuantities(init);
    } catch {
      toast.error('Failed to load PO');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPO) { toast.error('Select a Purchase Order'); return; }
    setSaving(true);
    try {
      const inv = await vendorInvoicesService.create({
        po_id: selectedPO.id,
        vendor_id: selectedPO.vendor_id,
        vendor_ref_number: form.vendor_ref_number || undefined,
        issue_date: form.issue_date,
        due_date: form.due_date || undefined,
        is_interstate: selectedPO.is_interstate,
        notes: form.notes || undefined,
        items: selectedPO.items.map(it => ({
          po_item_id: it.id,
          description: it.description,
          hsn_sac: it.hsn_sac,
          quantity_billed: parseFloat(quantities[it.id] ?? '0') || 0,
          unit_price: it.unit_price,
          tax_lines: it.tax_lines ?? [],
          sort_order: it.sort_order,
        })),
      });
      toast.success(`Vendor Invoice ${inv.invoice_number} created.`);
      router.push(`/vendor-invoices/${inv.id}`);
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Submit Vendor Invoice</h1>
        <p className="text-sm text-slate-500 mt-1">Enter what the vendor has billed. This will be matched against the PO and GRN.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Selection */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-700">Purchase Order</h2>
          {selectedPO ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <span className="font-mono font-semibold text-blue-700">{selectedPO.po_number} — {selectedPO.vendor_snapshot?.vendor_name}</span>
              <button type="button" onClick={() => setSelectedPO(null)} className="text-xs text-blue-500 hover:text-blue-700 underline cursor-pointer">Change</button>
            </div>
          ) : (
            <select onChange={e => { const po = pos.find(p => p.id === e.target.value); if (po) loadPO(po); }} defaultValue="" className={inputClass}>
              <option value="" disabled>Select a Purchase Order…</option>
              {pos.map(po => <option key={po.id} value={po.id}>{po.po_number} — {po.vendor_snapshot?.vendor_name}</option>)}
            </select>
          )}
        </div>

        {selectedPO && (
          <>
            {/* Invoice Details */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-700">Invoice Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Vendor Invoice Ref #</label>
                  <input value={form.vendor_ref_number} onChange={e => setForm(p => ({ ...p, vendor_ref_number: e.target.value }))} className={inputClass} placeholder="Vendor's own invoice number" />
                </div>
                <div>
                  <label className={labelClass}>Issue Date *</label>
                  <input type="date" value={form.issue_date} onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <label className={labelClass}>Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} placeholder="Internal notes…" />
                </div>
              </div>
            </div>

            {/* Billed quantities */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Quantities Billed</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter what the vendor has billed. PO quantity shown for reference.</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Qty</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Billed Qty *</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPO.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-700">{item.description}</td>
                      <td className="px-4 py-3 text-center text-slate-500 font-mono">{item.quantity}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={quantities[item.id] ?? ''}
                          onChange={e => setQuantities(p => ({ ...p, [item.id]: e.target.value }))}
                          className="border border-slate-200 rounded-md px-3 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-500 bg-white w-24 font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
          {selectedPO && (
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create Invoice
            </button>
          )}
        </div>
      </form>
    </div>
  );
}