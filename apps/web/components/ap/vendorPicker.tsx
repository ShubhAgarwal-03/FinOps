'use client';
import { useState, useEffect, useRef } from 'react';
import { Search, Building2, X } from 'lucide-react';
import { vendorsService } from '@/services/ap';
import type { Vendor } from '@/types/ap';

interface Props {
  value: string;
  onChange: (vendor: Vendor | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function VendorPicker({ value, onChange, placeholder = 'Select vendor…', disabled }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Vendor | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    vendorsService.getAll({ limit: 200 }).then(r => setVendors(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (value && vendors.length) {
      const v = vendors.find(v => v.id === value) ?? null;
      setSelected(v);
    }
    if (!value) setSelected(null);
  }, [value, vendors]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = vendors.filter(v =>
    v.vendor_name.toLowerCase().includes(query.toLowerCase()) ||
    (v.company_name ?? '').toLowerCase().includes(query.toLowerCase())
  );

  function select(v: Vendor) {
    setSelected(v);
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    setSelected(null);
    onChange(null);
  }

  const inputClass = 'border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full';

  if (selected) {
    return (
      <div className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2 bg-white">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-900 font-medium">{selected.vendor_name}</span>
          {selected.company_name && selected.company_name !== selected.vendor_name && (
            <span className="text-sm text-slate-500">— {selected.company_name}</span>
          )}
        </div>
        {!disabled && (
          <button type="button" onClick={clear} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputClass} pl-9`}
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
        />
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No vendors found</p>
          ) : (
            filtered.map(v => (
              <button
                type="button"
                key={v.id}
                onClick={() => select(v)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Building2 size={13} className="text-slate-400 flex-shrink-0" />
                <div>
                  <span className="font-medium text-slate-900">{v.vendor_name}</span>
                  {v.company_name && v.company_name !== v.vendor_name && (
                    <span className="text-slate-500 ml-1.5 text-xs">{v.company_name}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}