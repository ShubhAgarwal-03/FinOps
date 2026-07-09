'use client';

import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClass?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Generic confirm modal used across the AP workflow — PO issue, GRN confirm,
// dispute resolution, finance approve/reject/hold, delete actions.
// confirmClass lets callers swap the default red destructive styling for
// a neutral/blue affirmative action (e.g. "Issue PO").
export default function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm',
  confirmClass = 'bg-red-600 hover:bg-red-700 text-white',
  loading = false,
  onConfirm, onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => !loading && onCancel()}
      />
      <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 cursor-pointer flex items-center gap-2 ${confirmClass}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}