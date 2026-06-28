'use client';
import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { disputesService, type ResolveDisputePayload } from '@/services/ap';
import type { DisputeRecord, DisputeParty } from '@/types/ap';
import StatusBadge from '../../components/shared/statusBadge';
import { formatDate } from '../../../../libs/shared/utils/date.utils';

const PARTY_LABELS: Record<DisputeParty, string> = {
  vendor:           'Vendor — wrong invoice issued',
  internal:         'Internal / Warehouse — GRN count error',
  purchase_order:   'Procurement — PO had incorrect quantity',
};

const ACTION_LABELS: Record<string, string> = {
  accept_invoice: 'Accept Invoice as-is',
  amend_po:       'Raise PO Amendment',
  reject_invoice: 'Reject Invoice',
};

const PARTY_ACTIONS: Record<DisputeParty, ResolveDisputePayload['resolution_action'][]> = {
  vendor:         ['accept_invoice', 'reject_invoice'],
  internal:       ['accept_invoice', 'amend_po'],
  purchase_order: ['amend_po', 'reject_invoice'],
};

interface Props {
  vendorInvoiceId: string;
  dispute: DisputeRecord | null;
  onRaised: (dispute: DisputeRecord) => void;
  onResolved: (dispute: DisputeRecord) => void;
}

export default function DisputePanel({ vendorInvoiceId, dispute, onRaised, onResolved }: Props) {
  const [raising, setRaising] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [raiseForm, setRaiseForm] = useState({
    responsible_party: '' as DisputeParty | '',
    reason: '',
  });
  const [resolveForm, setResolveForm] = useState({
    resolution_action: '' as ResolveDisputePayload['resolution_action'] | '',
    resolution: '',
  });

  const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';

  async function handleRaise(e: React.FormEvent) {
    e.preventDefault();
    if (!raiseForm.responsible_party || !raiseForm.reason) {
      toast.error('Select responsible party and enter a reason');
      return;
    }
    setRaising(true);
    try {
      const d = await disputesService.create({
        vendor_invoice_id: vendorInvoiceId,
        responsible_party: raiseForm.responsible_party,
        reason: raiseForm.reason,
        raised_by: 'Procurement',
      });
      toast.success('Dispute raised');
      onRaised(d);
    } catch {
      toast.error('Failed to raise dispute');
    } finally {
      setRaising(false);
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!dispute || !resolveForm.resolution_action || !resolveForm.resolution) {
      toast.error('Select resolution action and enter resolution notes');
      return;
    }
    setResolving(true);
    try {
      const d = await disputesService.resolve(dispute.id, {
        resolution_action: resolveForm.resolution_action as ResolveDisputePayload['resolution_action'],
        resolution: resolveForm.resolution,
        resolved_by: 'Finance',
      });
      toast.success('Dispute resolved');
      onResolved(d);
    } catch {
      toast.error('Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  }

  // Existing open dispute
  if (dispute && dispute.status === 'open') {
    const availableActions = PARTY_ACTIONS[dispute.responsible_party] ?? [];
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-orange-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-600" />
          <h3 className="font-semibold text-orange-900">Open Dispute</h3>
          <StatusBadge status="open" className="ml-auto" />
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Responsible Party</p>
            <p className="text-sm text-slate-900">{PARTY_LABELS[dispute.responsible_party]}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Reason</p>
            <p className="text-sm text-slate-900">{dispute.reason}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Raised</p>
            <p className="text-sm text-slate-900">{formatDate(dispute.created_at)}</p>
          </div>
        </div>
        <form onSubmit={handleResolve} className="px-5 pb-5 space-y-3 border-t border-orange-200 pt-4">
          <p className="text-sm font-semibold text-slate-800">Resolve Dispute</p>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Resolution Action</label>
            <select
              className={inputClass}
              value={resolveForm.resolution_action}
              onChange={e => setResolveForm(p => ({ ...p, resolution_action: e.target.value as ResolveDisputePayload['resolution_action'] }))}
            >
              <option value="">Select action…</option>
              {availableActions.map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Resolution Notes</label>
            <textarea
              rows={3}
              className={inputClass}
              placeholder="Describe the corrective action taken…"
              value={resolveForm.resolution}
              onChange={e => setResolveForm(p => ({ ...p, resolution: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={resolving}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer"
            >
              {resolving && <Loader2 size={14} className="animate-spin" />}
              Mark as Resolved
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Resolved dispute — read only
  if (dispute && dispute.status !== 'open') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Dispute</h3>
          <StatusBadge status={dispute.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase font-medium tracking-wide mb-0.5">Responsible Party</p>
            <p className="text-slate-900">{PARTY_LABELS[dispute.responsible_party]}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-medium tracking-wide mb-0.5">Resolved</p>
            <p className="text-slate-900">{formatDate(dispute.resolved_at)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-500 uppercase font-medium tracking-wide mb-0.5">Resolution</p>
            <p className="text-slate-900">{dispute.resolution}</p>
          </div>
        </div>
      </div>
    );
  }

  // No dispute yet — raise form
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900">Raise Dispute</h3>
        <p className="text-xs text-slate-500 mt-0.5">Identify who is responsible and why the quantities do not match.</p>
      </div>
      <form onSubmit={handleRaise} className="px-5 py-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Responsible Party</label>
          <select
            className={inputClass}
            value={raiseForm.responsible_party}
            onChange={e => setRaiseForm(p => ({ ...p, responsible_party: e.target.value as DisputeParty }))}
          >
            <option value="">Select party…</option>
            {(Object.entries(PARTY_LABELS) as [DisputeParty, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Reason</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Describe the specific mismatch and reason…"
            value={raiseForm.reason}
            onChange={e => setRaiseForm(p => ({ ...p, reason: e.target.value }))}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={raising}
            className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer"
          >
            {raising && <Loader2 size={14} className="animate-spin" />}
            Raise Dispute
          </button>
        </div>
      </form>
    </div>
  );
}