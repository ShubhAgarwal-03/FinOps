'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { requisitionsService, rfpService } from '@/services/ap';
import type { Requisition } from '@/types/ap';
import WorkflowStepper, { type WorkflowStep } from '../../../../../web/components/shared/workflowStepper';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  converted_to_rfp: 'bg-blue-100 text-blue-700',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  converted_to_rfp: 'Converted to RFP',
};


function getSteps(status: string): WorkflowStep[] {
  const order = ['draft', 'pending_approval', 'approved', 'converted_to_rfp'];
  const idx = order.indexOf(status === 'rejected' ? 'pending_approval' : status);
  return [
    { label: 'Draft',        status: idx > 0 ? 'complete' : idx === 0 ? 'current' : 'upcoming' },
    { label: 'Approval',     status: idx > 1 ? 'complete' : idx === 1 ? 'current' : 'upcoming' },
    { label: 'Approved',     status: idx > 2 ? 'complete' : idx === 2 ? 'current' : 'upcoming' },
    { label: 'RFP Created',  status: idx >= 3 ? 'complete' : 'upcoming' },
  ];
}

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<'approve' | 'reject' | 'submit' | 'rfp' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    requisitionsService.getOne(id)
      .then(setReq)
      .catch(() => toast.error('Failed to load requisition'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit() {
    setActioning('submit');
    try {
      const updated = await requisitionsService.submit(id);
      setReq(updated);
      toast.success('Submitted for approval.');
    } catch {
      toast.error('Failed to submit');
    } finally {
      setActioning(null);
    }
  }

  async function handleApprove() {
    setActioning('approve');
    try {
      const updated = await requisitionsService.approve(id);
      setReq(updated);
      toast.success('Requisition approved.');
    } catch {
      toast.error('Failed to approve');
    } finally {
      setActioning(null);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Enter a rejection reason'); return; }
    setActioning('reject');
    try {
      const updated = await requisitionsService.reject(id, rejectReason);
      setReq(updated);
      setShowRejectInput(false);
      toast.success('Requisition rejected.');
    } catch {
      toast.error('Failed to reject');
    } finally {
      setActioning(null);
    }
  }

  async function handleCreateRFP() {
    if (!req) return;
    setActioning('rfp');
    try {
      const rfp = await rfpService.create({
        requisition_id: req.id,
        title: `RFP — ${req.title}`,
        description: req.description,
      });
      toast.success(`RFP ${rfp.rfp_number} created.`);
      router.push(`/rfp/${rfp.id}`);
    } catch {
      toast.error('Failed to create RFP');
    } finally {
      setActioning(null);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!req) return <div className="p-6 text-slate-500">Requisition not found.</div>;

  const isActioning = actioning !== null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{req.req_number}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[req.status] ?? 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[req.status] ?? req.status}</span>
          </div>
          <p className="text-slate-600">{req.title}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
        <WorkflowStepper steps={getSteps(req.status)} />
      </div>

      {/* Meta */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['Requested By', req.requested_by ?? '—'],
            ['Required By', req.required_by ? formatDate(req.required_by) : '—'],
            ['Created', formatDate(req.created_at)],
            ['Approved By', req.approved_by ?? '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        {req.description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-slate-700">{req.description}</p>
          </div>
        )}
        {req.rejection_reason && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-red-400 font-medium uppercase tracking-wide mb-1">Rejection Reason</p>
            <p className="text-sm text-red-700">{req.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Items Requested</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Description', 'Qty', 'Unit', 'Est. Unit Price', 'Notes'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {req.items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-slate-700">{item.description}</td>
                <td className="px-4 py-3 text-slate-900 font-medium">{item.quantity}</td>
                <td className="px-4 py-3 text-slate-500">{item.unit_of_measure ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {item.estimated_unit_price ? formatCurrency(item.estimated_unit_price, 'INR', 'IN') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-400">{item.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Actions</h2>

        {req.status === 'draft' && (
          <button onClick={handleSubmit} disabled={isActioning} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
            {actioning === 'submit' && <Loader2 size={14} className="animate-spin" />}
            Submit for Approval
          </button>
        )}

        {req.status === 'pending_approval' && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <button onClick={handleApprove} disabled={isActioning} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-60 cursor-pointer">
                {actioning === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Approve
              </button>
              <button onClick={() => setShowRejectInput(v => !v)} disabled={isActioning} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm rounded-md hover:bg-red-50 disabled:opacity-60 cursor-pointer">
                <XCircle size={14} />
                Reject
              </button>
            </div>
            {showRejectInput && (
              <div className="flex gap-2">
                <input
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection…"
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400 bg-white flex-1"
                />
                <button onClick={handleReject} disabled={isActioning} className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-60 flex items-center gap-2 cursor-pointer">
                  {actioning === 'reject' && <Loader2 size={14} className="animate-spin" />}
                  Confirm Reject
                </button>
              </div>
            )}
          </div>
        )}

        {req.status === 'approved' && (
          <button onClick={handleCreateRFP} disabled={isActioning} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 cursor-pointer">
            {actioning === 'rfp' ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Create RFP
          </button>
        )}

        {req.status === 'converted_to_rfp' && (
          <p className="text-sm text-slate-500">This requisition has been converted to an RFP.</p>
        )}

        {req.status === 'rejected' && (
          <p className="text-sm text-red-600">This requisition was rejected and cannot proceed.</p>
        )}
      </div>
    </div>
  );
}