'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Building2 } from 'lucide-react';
import { vendorsService } from '@/services/ap';
import { Vendor, VendorLedgerResponse } from '@/types/ap';

// PLACE AT: apps/web/app/(ap)/vendors/[id]/page.tsx

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [ledger, setLedger] = useState<VendorLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [v, l] = await Promise.all([
          vendorsService.getOne(id),
          vendorsService.getLedger(id).catch(() => null),
        ]);
        setVendor(v);
        setLedger(l);
      } catch {
        toast.error('Failed to load vendor');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  if (!vendor) return null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <button onClick={() => router.push('/vendors')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Vendors
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{vendor.vendor_name}</h1>
          {vendor.vendor_code && <p className="text-sm text-slate-400">{vendor.vendor_code}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Contact</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd className="text-slate-700">{vendor.email || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Phone</dt><dd className="text-slate-700">{vendor.phone || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Address</dt><dd className="text-slate-700 text-right">{vendor.address || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">City / State</dt><dd className="text-slate-700">{[vendor.city, vendor.state].filter(Boolean).join(', ') || '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Tax & Terms</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">GSTIN</dt><dd className="text-slate-700">{vendor.gstin || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">PAN</dt><dd className="text-slate-700">{vendor.pan || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Payment Terms</dt><dd className="text-slate-700">{vendor.payment_terms || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Currency</dt><dd className="text-slate-700">{vendor.currency}</dd></div>
          </dl>
        </div>
      </div>

      {ledger && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Ledger</h2>
            <div className="flex gap-6 text-xs text-slate-400">
              <span>Invoiced: <span className="text-slate-700 font-medium">{fmt(ledger.summary.total_invoiced)}</span></span>
              <span>Paid: <span className="text-slate-700 font-medium">{fmt(ledger.summary.total_paid)}</span></span>
              <span>Balance: <span className="text-slate-700 font-medium">{fmt(ledger.summary.closing_balance)}</span></span>
            </div>
          </div>
          {ledger.rows.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No transactions yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="py-2 font-medium text-right">Debit</th>
                  <th className="py-2 font-medium text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map(row => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-500">{new Date(row.entry_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-2 text-slate-700">{row.description}</td>
                    <td className="py-2 text-slate-400">{row.reference_number || '—'}</td>
                    <td className="py-2 text-right text-slate-700">{row.direction === 'DEBIT' ? fmt(row.amount) : ''}</td>
                    <td className="py-2 text-right text-slate-700">{row.direction === 'CREDIT' ? fmt(row.amount) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}