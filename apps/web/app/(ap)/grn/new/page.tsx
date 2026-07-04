'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { grnService, purchaseOrdersService } from '@/services/ap';
import type { PurchaseOrder } from '@/types/ap';
import { Suspense } from 'react';

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

function NewGRNPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [poSearch, setPoSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    purchaseOrdersService.getAll({ status: 'issued', limit: 100 })
      .then(r => {
        setPos(r.data);
        // Auto-select if coming from PO detail page
        if (poIdParam) {
          const match = r.data.find((p: PurchaseOrder) => p.id === poIdParam);
          if (match) selectPO(match);
        }
      })
      .catch(() => {});
  }, [poIdParam]);

  async function selectPO(po: PurchaseOrder) {
    setLoading(true);
    try {
      const full = await purchaseOrdersService.getOne(po.id);
      setSelectedPO(full);
      const init: Record<string, string> = {};
      full.items.forEach(it => { init[it.id] = String(it.quantity); });
      setQuantities(init);
    } catch {
      toast.error('Failed to load PO details');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPO) { toast.error('Select a Purchase Order'); return; }
    setSaving(true);
    try {
      const grn = await grnService.create({
        po_id: selectedPO.id,
        received_by: receivedBy || undefined,
        notes: notes || undefined,
        items: selectedPO.items.map(it => ({
          po_item_id: it.id,
          description: it.description,
          quantity_received: parseFloat(quantities[it.id] ?? '0') || 0,
          sort_order: it.sort_order,
        })),
      });
      toast.success(`GRN ${grn.grn_number} created.`);
      router.push(`/grn/${grn.id}`);
    } catch {
      toast.error('Failed to create GRN');
    } finally {
      setSaving(false);
    }
  }

  const filteredPOs = pos.filter(po =>
    po.po_number.toLowerCase().includes(poSearch.toLowerCase()) ||
    (po.vendor_snapshot?.vendor_name ?? '').toLowerCase().includes(poSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Record Delivery</h1>
        <p className="text-sm text-slate-500 mt-1">Select the Purchase Order and enter quantities actually received.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Picker */}
        {!selectedPO ? (
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700">Select Purchase Order</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={poSearch}
                onChange={e => setPoSearch(e.target.value)}
                placeholder="Search by PO number or vendor…"
                className={`${inputClass} pl-9`}
              />
            </div>
            {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" size={20} /></div>}
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {filteredPOs.length === 0 ? (
                <p className="text-sm text-slate-400 px-4 py-3">No issued POs available.</p>
              ) : filteredPOs.map(po => (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => selectPO(po)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="font-mono font-semibold text-blue-600 text-sm">{po.po_number}</span>
                    <span className="text-slate-500 text-sm ml-3">{po.vendor_snapshot?.vendor_name}</span>
                  </div>
                  <span className="text-xs text-slate-400">{po.items.length} items</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <span className="font-mono font-semibold text-blue-700">{selectedPO.po_number}</span>
                <span className="text-blue-600 text-sm ml-2">— {selectedPO.vendor_snapshot?.vendor_name}</span>
              </div>
              <button type="button" onClick={() => setSelectedPO(null)} className="text-xs text-blue-500 hover:text-blue-700 underline cursor-pointer">Change</button>
            </div>

            {/* Received quantities */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Quantities Received</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter what was actually delivered. PO quantity shown for reference.</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Qty</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Received Qty *</th>
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
                          step="1"
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

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-700">Receipt Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Received By</label>
                  <input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} className={inputClass} placeholder="Warehouse staff name" />
                </div>
                <div>
                  <label className={labelClass}>Notes</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder="Condition, partial delivery note…" />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
          {selectedPO && (
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create GRN
            </button>
          )}
        </div>
      </form>
    </div>
    );
}

export default function NewGRNPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading…</div>}>
      <NewGRNPageInner />
    </Suspense>
  );
}