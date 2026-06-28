import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { MatchResult, MatchItemDetail } from '@/types/ap';
import { cn } from '../../../../libs/shared/utils/index';

interface Props {
  result: MatchResult;
}

export default function MatchResultCard({ result }: Props) {
  const isMatched = result.status === 'matched';

  return (
    <div className={cn(
      'rounded-lg border-2 overflow-hidden',
      isMatched ? 'border-green-200' : 'border-amber-200'
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-3 px-5 py-4',
        isMatched ? 'bg-green-50' : 'bg-amber-50'
      )}>
        {isMatched
          ? <CheckCircle2 size={22} className="text-green-600 flex-shrink-0" />
          : <XCircle size={22} className="text-amber-600 flex-shrink-0" />
        }
        <div>
          <p className={cn('font-semibold text-base', isMatched ? 'text-green-800' : 'text-amber-800')}>
            {isMatched ? '3-Way Match — MATCHED' : '3-Way Match — MISMATCH'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Matched {new Date(result.matched_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Line items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Qty</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">GRN Qty</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice Qty</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.line_item_results.map((item: MatchItemDetail, i: number) => (
              <tr key={item.po_item_id ?? i} className={item.is_matched ? '' : 'bg-amber-50/50'}>
                <td className="px-5 py-3 text-slate-700 max-w-[200px]">
                  <span className="truncate block">{item.description}</span>
                </td>
                <td className="px-4 py-3 text-center font-mono text-slate-900">{item.po_quantity}</td>
                <td className={cn(
                  'px-4 py-3 text-center font-mono',
                  item.grn_quantity !== item.po_quantity ? 'text-amber-700 font-semibold' : 'text-slate-900'
                )}>
                  {item.grn_quantity}
                </td>
                <td className={cn(
                  'px-4 py-3 text-center font-mono',
                  item.invoice_quantity !== item.po_quantity ? 'text-amber-700 font-semibold' : 'text-slate-900'
                )}>
                  {item.invoice_quantity}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.is_matched
                    ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                    : (
                      <div className="flex flex-col items-center gap-1">
                        <XCircle size={16} className="text-amber-500 mx-auto" />
                        {item.discrepancy_note && (
                          <span className="text-[10px] text-amber-700 max-w-[120px] text-center leading-tight">{item.discrepancy_note}</span>
                        )}
                      </div>
                    )
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isMatched && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            Quantities do not match. Raise a dispute to identify the responsible party and take corrective action before payment can proceed.
          </p>
        </div>
      )}
    </div>
  );
}