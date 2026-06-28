'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { disputesService, matchService, vendorInvoicesService } from '@/services/ap';
import type { DisputeRecord, DisputeParty, MatchResultPayload, VendorInvoice } from '@/types/ap';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';

const PARTY_LABEL: Record<DisputeParty, string> = {
  vendor:          'Vendor — billed wrong quantity',
  internal:        'Internal — GRN recorded incorrectly',
  purchase_order:  'Purchase Order — PO raised with wrong quantity',
};

const RESOLUTION_OPTIONS = [
  { value: 'resolved_accept',   label: 'Accept vendor\'s quantity — approve payment as-is' },
  { value: 'resolved_reject',   label: 'Reject invoice — vendor to resubmit corrected invoice' },
  { value: 'resolved_amend_po', label: 'Raise PO amendment — correct the PO quantity' },
];

const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';

export default function DisputePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultPayload | null>(null);
  const [existing, setExisting] = useState<DisputeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form
  const [party, setParty] = useState<DisputeParty>('vendor');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Resolve form
  const [resolution, setResolution] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [inv, res, disputes] = await Promise.allSettled([
          vendorInvoicesService.getOne(id),
          matchService.getResult(id),
          disputesService.getForInvoice(id),
        ]);
        if (inv.status === 'fulfilled') setInvoice(inv.value);
        if (res.status === 'fulfilled') setMatchResult(res.value);
        if (disputes.status === 'fulfilled' && disputes.value.length > 0) {
          setExisting(disputes.value[0]);
        }
      } catch {
        toast.error('Failed to load dispute data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleCreate() {
    if (!description.trim()) { toast.error('Please describe the dispute.'); return; }
    if (!matchResult) { toast.error('No match result found.'); return; }

    const mismatches = matchResult.item_results.filter(r => !r.is_matched);
    setSubmitting(true);
    try {
      const dispute = await disputesService.create({
        vendor_invoice_id: id,
        responsible_party: party,
        description,
        mismatch_detail: mismatches as any,
      });
      setExisting(dispute);
      toast.success('Dispute raised.');
    } catch {
      toast.error('Failed to raise dispute.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve() {
    if (!existing) return;
    if (!resolution) { toast.error('Select a resolution path.'); return; }
    if (!resolutionNotes.trim()) { toast.error('Add resolution notes.'); return; }
    setResolving(true);
    try {
      const updated = await disputesService.resolve(existing.id, {
        status: resolution as DisputeRecord['status'],
        resolution_notes: resolutionNotes,
      });
      setExisting(updated);
      toast.success('Dispute resolved.');
      // Redirect based on resolution
      if (resolution === 'resolved_reject') {
        router.push(`/vendor-invoices/${id}`);
      } else if (resolution === 'resolved_amend_po' && invoice?.po_id) {
        router.push(`/purchase-orders/${invoice.po_id}/amend`);
      } else {
        router.push(`/vendor-invoices/${id}/match`);
      }
    } catch {
      toast.error('Failed to resolve dispute.');
    } finally {
      setResolving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/vendor-invoices/${id}/match`)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dispute Resolution</h1>
          <p className="text-slate-500 text-sm">{invoice?.invoice_number}</p>
        </div>
      </div>

      {/* Mismatch summary */}
      {matchResult && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Mismatched Items
          </p>
          <div className="space-y-2">
            {matchResult.item_results.filter(r => !r.is_matched).map(item => (
              <div key={item.po_item_id} className="bg-white rounded-lg p-3 border border-red-100">
                <p className="font-medium text-slate-700 text-sm">{item.description}</p>
                <div className="flex gap-4 mt-1 text-xs text-slate-500">
                  <span>PO: <span className="font-mono font-medium text-slate-700">{item.po_quantity}</span></span>
                  <span>GRN: <span className={`font-mono font-medium ${item.po_quantity !== item.grn_quantity ? 'text-red-600' : 'text-slate-700'}`}>{item.grn_quantity}</span></span>
                  <span>Invoice: <span className={`font-mono font-medium ${item.grn_quantity !== item.invoice_quantity ? 'text-red-600' : 'text-slate-700'}`}>{item.invoice_quantity}</span></span>
                </div>
                {item.discrepancy_note && <p className="text-xs text-red-600 mt-1">{item.discrepancy_note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!existing ? (
        /* Create dispute */
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Raise Dispute</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Responsible Party</label>
              <div className="space-y-2">
                {(Object.entries(PARTY_LABEL) as [DisputeParty, string][]).map(([value, label]) => (
                  <label key={value} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input type="radio" name="party" value={value} checked={party === value}
                      onChange={() => setParty(value)} className="mt-0.5" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                rows={3}
                className={inputClass}
              />
            </div>

            <button onClick={handleCreate} disabled={submitting}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 cursor-pointer">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Raise Dispute
            </button>
          </div>
        </div>
      ) : (
        /* Resolve dispute */
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Dispute #{existing.id.slice(-6).toUpperCase()}</h2>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              existing.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
            }`}>
              {existing.status === 'open' ? 'Open' : 'Resolved'}
            </span>
          </div>

          <div className="space-y-3 mb-6 text-sm">
            <div>
              <span className="text-slate-500">Responsible party: </span>
              <span className="text-slate-700 font-medium">{PARTY_LABEL[existing.responsible_party]}</span>
            </div>
            <div>
              <span className="text-slate-500">Description: </span>
              <span className="text-slate-700">{existing.description}</span>
            </div>
            {existing.resolution_notes && (
              <div>
                <span className="text-slate-500">Resolution: </span>
                <span className="text-slate-700">{existing.resolution_notes}</span>
              </div>
            )}
          </div>

          {existing.status === 'open' && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h3 className="font-medium text-slate-800">Resolve Dispute</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resolution Path</label>
                <div className="space-y-2">
                  {RESOLUTION_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="radio" name="resolution" value={opt.value} checked={resolution === opt.value}
                        onChange={() => setResolution(opt.value)} className="mt-0.5" />
                      <span className="text-sm text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resolution Notes</label>
                <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Document the resolution decision..."
                  rows={3} className={inputClass} />
              </div>

              <button onClick={handleResolve} disabled={resolving}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                {resolving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Resolution
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}