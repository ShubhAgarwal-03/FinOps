'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Building2, Edit, BookOpen } from 'lucide-react';
import { vendorsService } from '@/services/ap';
import type { Vendor, VendorLedgerResponse } from '@/types/ap';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';
import { formatDate } from '../../../../../../libs/shared/utils/date.utils';

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [ledger, setLedger] = useState<VendorLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    vendorsService.getOne(id)
      .then(setVendor)
      .catch(() => toast.error('Failed to load vendor'))
      .finally(() => setLoading(false));
  }, [id]);

  async function loadLedger() {
    if (ledger) { setShowLedger(true); return; }
    setLoadingLedger(true);
    try {
      const data = await vendorsService.getLedger(id);
      setLedger(data);
      setShowLedger(true);
    } catch {
      toast.error('Failed to load ledger');
    } finally {
      setLoadingLedger(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!vendor) return <div className="p-6 text-slate-500">Vendor not found.</div>;

  const fmt = (n: number) => formatCurrency(n, vendor.currency, vendor.country);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{vendor.vendor_name}</h1>
            {vendor.company_name && vendor.company_name !== vendor.vendor_name && (
              <p className="text-sm text-slate-500">{vendor.company_name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLedger}
            disabled={loadingLedger}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            {loadingLedger ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
            Ledger
          </button>
          <button
            onClick={() => router.push(`/vendors/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
          >
            <Edit size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</h2>
          {[
            ['Email', vendor.email],
            ['Phone', vendor.phone],
            ['Currency', vendor.currency],
            ['Payment Terms', vendor.payment_terms],
          ].map(([label, value]) => value ? (
            <div key={label as string}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-sm text-slate-900">{value}</p>
            </div>
          ) : null)}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax & Address</h2>
          {[
            ['GSTIN', vendor.gstin],
            ['PAN', vendor.pan],
            ['City', vendor.city],
            ['State', vendor.state],
            ['Country', vendor.country],
          ].map(([label, value]) => value ? (
            <div key={label as string}>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-sm text-slate-900 font-mono">{value}</p>
            </div>
          ) : null)}
        </div>
      </div>

      {/* Ledger */}
      {showLedger && ledger && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Vendor Ledger</h2>
            <div className="flex gap-6 text-sm">
              <div className="text-right">
                <p className="text-xs text-slate-400">Total Invoiced</p>
                <p className="font-semibold text-slate-900">{fmt(ledger.summary.total_invoiced)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Total Paid</p>
                <p className="font-semibold text-green-700">{fmt(ledger.summary.total_paid)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Balance Due</p>
                <p className="font-semibold text-red-600">{fmt(ledger.summary.closing_balance)}</p>
              </div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(row.entry_date)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{row.description}</td>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{row.reference_number ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-900">
                    {row.direction === 'DEBIT' ? fmt(row.amount) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-900">
                    {row.direction === 'CREDIT' ? fmt(row.amount) : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{fmt(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger.rows.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">No ledger entries yet.</p>
          )}
        </div>
      )}
    </div>
  );
}