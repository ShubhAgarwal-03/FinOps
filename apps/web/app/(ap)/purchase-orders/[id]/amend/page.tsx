'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { purchaseOrdersService } from '@/services/ap';
import { PurchaseOrder } from '@/types/ap';

// PLACE AT: apps/web/app/(ap)/purchase-orders/[id]/amend/page.tsx
// The original PO row is never edited directly — this appends a new
// POAmendment record referencing it, per the PRD's non-negotiable rule.

interface FieldOption {
  key: string;          // unique identifier, also what gets sent as `field`
  label: string;
  type: 'number' | 'date' | 'text';
  currentValue: string;
}

function buildFieldOptions(po: PurchaseOrder): FieldOption[] {
  const options: FieldOption[] = [];

  po.items.forEach((item) => {
    options.push({
      key: `item:${item.id}:quantity`,
      label: `Quantity — ${item.description}`,
      type: 'number',
      currentValue: String(item.quantity),
    });
    options.push({
      key: `item:${item.id}:unit_price`,
      label: `Unit Price — ${item.description}`,
      type: 'number',
      currentValue: String(item.unit_price),
    });
  });

  options.push(
    { key: 'payment_terms', label: 'Payment Terms', type: 'text', currentValue: po.payment_terms ?? '' },
    { key: 'delivery_address', label: 'Delivery Address', type: 'text', currentValue: po.delivery_address ?? '' },
    { key: 'expected_delivery', label: 'Expected Delivery', type: 'date', currentValue: po.expected_delivery ? po.expected_delivery.slice(0, 10) : '' },
    { key: 'notes', label: 'Notes', type: 'text', currentValue: po.notes ?? '' },
  );

  return options;
}

interface ChangeRow {
  fieldKey: string;
  new_value: string;
}

const emptyRow = (): ChangeRow => ({ fieldKey: '', new_value: '' });
const inputClass = 'px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white w-full';

export default function POAmendPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<ChangeRow[]>([emptyRow()]);

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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  if (!po) return null;

  const fieldOptions = buildFieldOptions(po);

  function updateRow(i: number, patch: Partial<ChangeRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function addRow() { setRows(prev => [...prev, emptyRow()]); }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { toast.error('A reason is required'); return; }

    const validRows = rows.filter(r => r.fieldKey && r.new_value.trim());
    if (validRows.length === 0) { toast.error('At least one change is required'); return; }

    const changes = validRows.map(r => {
      const opt = fieldOptions.find(o => o.key === r.fieldKey)!;
      return {
        field: opt.label,
        old_value: opt.type === 'number' ? Number(opt.currentValue) || 0 : opt.currentValue,
        new_value: opt.type === 'number' ? Number(r.new_value) || 0 : r.new_value,
      };
    });

    setSaving(true);
    try {
      await purchaseOrdersService.createAmendment(id, { reason, changes });
      toast.success('Amendment recorded');
      router.push(`/purchase-orders/${id}`);
    } catch {
      toast.error('Failed to record amendment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <button onClick={() => router.push(`/purchase-orders/${id}`)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> {po.po_number}
      </button>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Raise PO Amendment</h1>
      <p className="text-sm text-slate-500 mb-6">
        Amendment #{po.amendments.length + 1} — the original PO stays locked; this appends a tracked correction.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Reason *</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Why is this correction being made?"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-2">Changes *</label>
          <div className="space-y-3">
            {rows.map((row, i) => {
              const opt = fieldOptions.find(o => o.key === row.fieldKey);
              return (
                <div key={i} className="flex items-start gap-2">
                  <select
                    value={row.fieldKey}
                    onChange={e => updateRow(i, { fieldKey: e.target.value, new_value: '' })}
                    className={inputClass + ' flex-[1.2]'}
                  >
                    <option value="">Select field to amend…</option>
                    {fieldOptions.map(o => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>

                  <div className="flex-1">
                    <input
                      value={opt?.currentValue ?? ''}
                      disabled
                      className={inputClass + ' bg-slate-50 text-slate-400'}
                      placeholder="Current value"
                    />
                  </div>

                  <div className="flex-1">
                    <input
                      type={opt?.type === 'date' ? 'date' : opt?.type === 'number' ? 'number' : 'text'}
                      value={row.new_value}
                      onChange={e => updateRow(i, { new_value: e.target.value })}
                      disabled={!opt}
                      className={inputClass}
                      placeholder="New value"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="p-2 text-slate-300 hover:text-red-500 cursor-pointer flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-3 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add another change
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/purchase-orders/${id}`)}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Record Amendment
          </button>
        </div>
      </form>
    </div>
  );
}