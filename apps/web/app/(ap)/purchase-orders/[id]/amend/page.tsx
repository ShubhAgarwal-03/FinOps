'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { purchaseOrdersService } from '@/services/ap';

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';
const labelClass = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

export default function POAmendPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [field, setField] = useState('');
  const [oldValue, setOldValue] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    if (!field.trim() || !newValue.trim()) { toast.error('Specify what changed'); return; }
    setSaving(true);
    try {
      await purchaseOrdersService.createAmendment(id, {
        reason,
        changes: [{ field, old_value: oldValue, new_value: newValue }],
      });
      toast.success('PO Amendment raised.');
      router.push(`/purchase-orders/${id}/amendments`);
    } catch {
      toast.error('Failed to raise amendment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Raise PO Amendment</h1>
        <p className="text-sm text-slate-500 mt-1">The original PO remains locked. This amendment is a separate tracked document.</p>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
        <AlertCircle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          Do not attempt to edit the PO directly. All corrections must go through amendments to preserve the audit trail.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <label className={labelClass}>Reason for Amendment *</label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className={inputClass}
              placeholder="Explain why this PO needs to be corrected…"
              required
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Change Record</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Field Changed *</label>
                <input value={field} onChange={e => setField(e.target.value)} className={inputClass} placeholder="e.g. quantity, unit_price" required />
              </div>
              <div>
                <label className={labelClass}>Old Value</label>
                <input value={oldValue} onChange={e => setOldValue(e.target.value)} className={inputClass} placeholder="Previous value" />
              </div>
              <div>
                <label className={labelClass}>New Value *</label>
                <input value={newValue} onChange={e => setNewValue(e.target.value)} className={inputClass} placeholder="Corrected value" required />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-amber-600 text-white text-sm font-semibold rounded-md hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Submit Amendment
          </button>
        </div>
      </form>
    </div>
  );
}