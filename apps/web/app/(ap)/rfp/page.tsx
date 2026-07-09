'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, FileSearch } from 'lucide-react';
import { rfpService } from '@/services/ap';
import { RFP, RFPStatus } from '@/types/ap';
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus';
import { getStepAccess } from '@/lib/workflow/stepAccess';
import StageLockBanner from '../../../components/shared/stageLockBanner';

// PLACE AT: apps/web/app/(ap)/rfp/page.tsx
// NOTE: RFPs are created from an approved Requisition's detail page
// ("Create RFP" button) — there's no standalone /rfp/new route.

const STATUS_BADGE: Record<RFPStatus, string> = {
  open: 'bg-slate-100 text-slate-500',
  evaluating: 'bg-amber-100 text-amber-700',
  vendor_selected: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
};

export default function RFPListPage() {
  const router = useRouter();
  const { status } = useWorkflowStatus();
  const access = getStepAccess(status, 'rfp');
  const [items, setItems] = useState<RFP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await rfpService.getAll({ limit: 50 });
        setItems(res.data);
      } catch {
        toast.error('Failed to load RFPs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">RFPs</h1>
        <p className="text-sm text-slate-400 mt-1">{items.length} request{items.length !== 1 ? 's' : ''} for proposal</p>
      </div>

      {!access.unlocked && <StageLockBanner reason={access.reason} />}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <FileSearch className="w-8 h-8 mb-2" />
            <p className="text-sm">No RFPs yet — create one from an approved requisition</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Quotes</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/rfp/${r.id}`)}>
                  <td className="px-5 py-3 font-medium text-slate-700">{r.rfp_number}</td>
                  <td className="px-5 py-3 text-slate-600">{r.title}</td>
                  <td className="px-5 py-3 text-slate-500">{r.vendor_quotes?.length ?? 0}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
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