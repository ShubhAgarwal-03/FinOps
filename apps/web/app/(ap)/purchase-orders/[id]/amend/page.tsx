'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { purchaseOrdersService } from '@/services/ap';
import { PurchaseOrder, POAmendment } from '@/types/ap';

// PLACE AT: apps/web/app/(ap)/purchase-orders/[id]/amend/page.tsx
// The original PO row is never edited directly — this appends a new
// POAmendment record referencing it, per the PRD's non-negotiable rule.

type ChangeRow = POAmendment['changes'][number];

export default function POAmendPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');
  const [changes, setChanges] = useState<ChangeRow[]>([{ field: '', old_value: '', new_value: '' }]);

  useEffect(() => {
    (async () => {
      try {
        const data = await purchaseOrdersService.getOne(id);
        if (data.status !== 'issued') {
          toast.error('Amendments can only be raised against an issued PO');
          router.push(`/purchase-orders/${id}`);
          return;
        }
        setPo(data);
      } catch {
        toast.error('Failed to load purchase order');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateChange(i: number, key: keyof ChangeRow, value: string) {
    setChanges(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: value } : c));
  }
  function addChange() {
    setChanges(prev => [...prev, { field: '', old_value: '', new_value: '' }]);
  }
  function removeChange(i: number) {
    setChanges(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { toast.error('A reason is required'); return; }
    const validChanges = changes.filter(c => c.field.trim());
    if (validChanges.length === 0) { toast.error('At least one change is required'); return; }
    setSaving(true);
    try {
      await purchaseOrdersService.createAmendment(id, { reason, changes: validChanges });
      toast.success('Amendment recorded');
      router.push(`/purchase-orders/${id}`);
    } catch {
      toast.error('Failed to record amendment');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  if (!po) return null;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <button onClick={() => router.push(`/purchase-orders/${id}`)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> {po.po_number}
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Raise PO Amendment</h1>
      <p className="text-sm text-slate-400 mb-6">Amendment #{po.amendments.length + 1} — the original PO stays locked; this appends a tracked correction.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Reason *</label>
          <textarea
            required
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-2">Changes *</label>
          <div className="space-y-2">
            {changes.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  placeholder="Field (e.g. quantity)"
                  value={c.field}
                  onChange={e => updateChange(i, 'field', e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <input
                  placeholder="Old value"
                  value={String(c.old_value ?? '')}
                  onChange={e => updateChange(i, 'old_value', e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <input
                  placeholder="New value"
                  value={String(c.new_value ?? '')}
                  onChange={e => updateChange(i, 'new_value', e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button type="button" onClick={() => removeChange(i)} className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addChange} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline mt-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add another change
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.push(`/purchase-orders/${id}`)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Record Amendment
          </button>
        </div>
      </form>
    </div>
  );
}