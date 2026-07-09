'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, PackageCheck } from 'lucide-react';
import { grnService } from '@/services/ap';
import { GRN, GRNStatus } from '@/types/ap';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';
import { getStepAccess } from '@/lib/workflow/stepAccess';
import StageLockBanner from '../../../components/shared/stageLockBanner';

// PLACE AT: apps/web/app/(ap)/grn/page.tsx
// grn/new/page.tsx and grn/[id]/page.tsx already exist — this is just the
// missing list view that links out to them.

const STATUS_BADGE: Record<GRNStatus, string> = {
  draft: 'bg-slate-100 text-slate-500',
  confirmed: 'bg-green-100 text-green-700',
};

export default function GRNListPage() {
  const router = useRouter();
  const { status } = useWorkflowStatus();
  const access = getStepAccess(status, 'grn');
  const [items, setItems] = useState<GRN[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await grnService.getAll({ limit: 50 });
        setItems(res.data);
      } catch {
        toast.error('Failed to load GRNs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Goods Receipt Notes</h1>
        <p className="text-sm text-slate-400 mt-1">{items.length} GRN{items.length !== 1 ? 's' : ''}</p>
      </div>

      {!access.unlocked && <StageLockBanner reason={access.reason} />}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <PackageCheck className="w-8 h-8 mb-2" />
            <p className="text-sm">No GRNs yet — record one from an issued purchase order</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">GRN Number</th>
                <th className="px-5 py-3 font-medium">PO Number</th>
                <th className="px-5 py-3 font-medium">Received By</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(g => (
                <tr key={g.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/grn/${g.id}`)}>
                  <td className="px-5 py-3 font-medium text-slate-700">{g.grn_number}</td>
                  <td className="px-5 py-3 text-slate-600">{g.po?.po_number || g.po_id}</td>
                  <td className="px-5 py-3 text-slate-500">{g.received_by || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[g.status]}`}>{g.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}