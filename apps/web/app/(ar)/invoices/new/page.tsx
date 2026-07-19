'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { invoiceServices } from '@/services/ar';
import { customersService, itemsService } from '../../../../lib/api/ar/index';
import { Customer, Item } from '@/types/ar';
import { formatCurrency } from '../../../../../../libs/shared/utils/currency.utils';
import { Loader2, Plus, Trash2, X, UserPlus } from 'lucide-react';

// PLACE AT: apps/web/app/(ar)/invoices/new/page.tsx
// Line-item builder ported from the original Invoice-Generator's
// invoices/new page (customer card + line-item table + totals panel),
// re-wired for FinOps: uses services/ar.ts (the same invoiceServices the
// working /invoices list + detail pages already use) instead of a raw
// fetch, pulls the shared Item catalogue via /api/items, and submits
// `tax_lines: [{ name, percent }]` per line — the shape
// calculateTotalsForService() in libs/shared/engines/totals actually
// expects — rather than the generic `taxes` field name from the original.
//
// Note: there's no global Tax entity/route in FinOps (unlike the original
// Invoice-Generator's /api/taxes), so tax lines are entered per-item here
// instead of picked from a shared list. Selecting a catalogue item still
// auto-fills unit price, HSN/SAC and a default tax line from that item's
// tax_percent.

type LineTax = { name: string; percent: number };
type LineItem = {
  item_id?: string;
  description: string;
  hsn_sac: string;
  quantity: string;
  unit_price: string;
  taxes: LineTax[];
};

const emptyLine = (): LineItem => ({
  item_id: undefined,
  description: '',
  hsn_sac: '',
  quantity: '1',
  unit_price: '0',
  taxes: [],
});

const today = new Date().toISOString().split('T')[0];

const COUNTRIES = [
  { code: 'IN', name: 'India' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' }, { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
];

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR',
  AU: 'AUD', CA: 'CAD', JP: 'JPY', SG: 'SGD', AE: 'AED',
};

export default function NewInvoicePage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerId, setCustomerId] = useState('');

  const [poSoNumber, setPoSoNumber] = useState('');
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState('');

  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);

  const [discountPercent, setDiscountPercent] = useState('0');
  const [discountAdded, setDiscountAdded] = useState(false);

  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);

  const [saving, setSaving] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalStep, setCustomerModalStep] = useState<'choice' | 'new' | 'existing'>('choice');
  const [existingCustomerId, setExistingCustomerId] = useState('');
  const [customerForm, setCustomerForm] = useState({
    customer_code: '', customer_type: 'business', customer_name: '', company_name: '',
    email: '', phone: '', billing_address_1: '', billing_address_2: '', city: '', state: '', postal_code: '',
    country: 'IN', currency: 'INR', gstin: '', pan: '', registration_number: '',
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [currencyManuallySet, setCurrencyManuallySet] = useState(false);

  useEffect(() => {
    Promise.all([customersService.getAll(), itemsService.getAll()])
      .then(([c, i]) => { setCustomers(c); setItems(i); })
      .catch(() => toast.error('Failed to load customers/items'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSelectedCustomer(customers.find(c => c.id === customerId) ?? null);
  }, [customerId, customers]);

  function calcLine(line: LineItem) {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const base = qty * price;
    let taxTotal = 0;
    const resolvedTaxes = line.taxes.map(t => {
      const amt = base * (t.percent / 100);
      taxTotal += amt;
      return { ...t, amount: amt };
    });
    return { base, taxTotal, total: base + taxTotal, resolvedTaxes };
  }

  let itemsBase = 0;
  let totalTax = 0;
  const taxBreakdown: Record<string, { name: string; percent: number; amount: number }> = {};

  lineItems.forEach(line => {
    const { base, resolvedTaxes } = calcLine(line);
    itemsBase += base;
    resolvedTaxes.forEach(t => {
      const key = `${t.name}-${t.percent}`;
      if (!taxBreakdown[key]) taxBreakdown[key] = { name: t.name, percent: t.percent, amount: 0 };
      taxBreakdown[key].amount += t.amount;
      totalTax += t.amount;
    });
  });

  const subtotal = itemsBase + totalTax;
  const discP = parseFloat(discountPercent) || 0;
  const discountAmount = subtotal * (discP / 100);
  const grandTotal = subtotal - discountAmount;

  const currency = selectedCustomer?.currency ?? 'INR';
  const country = selectedCustomer?.country ?? 'IN';
  const fmt = (n: number) => formatCurrency(n, currency, country);

  function updateLine(index: number, field: keyof LineItem, value: any) {
    setLineItems(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function selectCatalogueItem(index: number, itemName: string) {
    const item = items.find(it => it.name === itemName);
    if (!item) { updateLine(index, 'description', itemName); return; }
    setLineItems(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const taxPct = Number(item.tax_percent) || 0;
      return {
        ...l,
        item_id: item.id,
        description: item.name,
        hsn_sac: item.hsn_sac ?? '',
        unit_price: String(Number(item.unit_price) || 0),
        taxes: taxPct > 0 ? [{ name: 'Tax', percent: taxPct }] : l.taxes,
      };
    }));
  }

  function addTaxToLine(index: number) {
    setLineItems(prev => prev.map((l, i) => i === index ? { ...l, taxes: [...l.taxes, { name: '', percent: 0 }] } : l));
  }

  function updateLineTax(index: number, taxIndex: number, field: 'name' | 'percent', value: string) {
    setLineItems(prev => prev.map((l, i) => {
      if (i !== index) return l;
      const taxes = l.taxes.map((t, ti) => ti === taxIndex ? { ...t, [field]: field === 'percent' ? (parseFloat(value) || 0) : value } : t);
      return { ...l, taxes };
    }));
  }

  function removeLineTax(index: number, taxIndex: number) {
    setLineItems(prev => prev.map((l, i) => i === index ? { ...l, taxes: l.taxes.filter((_, ti) => ti !== taxIndex) } : l));
  }

  function addLine() { setLineItems(prev => [...prev, emptyLine()]); }
  function removeLine(index: number) {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error('Please select a customer'); return; }
    if (lineItems.some(l => !l.description.trim())) { toast.error('Every line item needs a description'); return; }

    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        po_so_number: poSoNumber || undefined,
        issue_date: issueDate,
        due_date: dueDate || undefined,
        discount_percent: discP,
        tax_exempt: taxExempt,
        payment_terms: paymentTerms || undefined,
        notes: notes || undefined,
        items: lineItems.map((l, idx) => ({
          item_id: l.item_id,
          description: l.description,
          hsn_sac: l.hsn_sac || undefined,
          quantity: parseFloat(l.quantity) || 0,
          unit_price: parseFloat(l.unit_price) || 0,
          tax_lines: l.taxes.filter(t => t.name.trim()).map(t => ({ name: t.name, percent: t.percent })),
          sort_order: idx,
        })),
      };
      const inv = await invoiceServices.create(payload);
      toast.success(`Invoice ${inv.invoice_number} created.`);
      router.push('/invoices');
    } catch {
      toast.error('Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerForm.customer_name.trim()) { toast.error('Contact name is required'); return; }
    setSavingCustomer(true);
    try {
      const created = await customersService.create(customerForm as Partial<Customer>);
      setCustomers(prev => [created, ...prev]);
      setCustomerId(created.id);
      setShowCustomerModal(false);
      toast.success('Customer created.');
    } catch {
      toast.error('Failed to create customer');
    } finally {
      setSavingCustomer(false);
    }
  }

  function handleCustomerFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (name === 'currency') {
      setCurrencyManuallySet(true);
      setCustomerForm(p => ({ ...p, currency: value }));
    } else if (name === 'country') {
      const derived = COUNTRY_CURRENCY[value];
      setCustomerForm(p => ({ ...p, country: value, ...((!currencyManuallySet && derived) ? { currency: derived } : {}) }));
    } else {
      setCustomerForm(p => ({ ...p, [name]: value }));
    }
  }

  const inputClass = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all';

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">New Invoice</h1>

      <form onSubmit={handleSubmit}>
        {/* TOP SECTION */}
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
          {/* Customer Card */}
          <div className="w-72">
            {!selectedCustomer ? (
              <div
                onClick={() => { setCustomerModalStep('choice'); setExistingCustomerId(''); setShowCustomerModal(true); }}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50/50 cursor-pointer h-48 transition-colors"
              >
                <div className="w-12 h-12 rounded-full border-2 border-blue-600 flex items-center justify-center mb-2">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="font-semibold">Add a customer</span>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-6 h-48 relative shadow-sm bg-white">
                <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerId(''); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
                <h3 className="font-bold text-lg text-slate-800">{selectedCustomer.company_name || selectedCustomer.customer_name}</h3>
                <p className="text-slate-500 text-sm mt-1">{selectedCustomer.email}</p>
                <p className="text-slate-500 text-sm">{selectedCustomer.billing_address_1}</p>
                <p className="text-slate-500 text-sm">{selectedCustomer.city}, {selectedCustomer.country}</p>
                <p className="mt-4 text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded inline-block">Currency: {selectedCustomer.currency}</p>
              </div>
            )}
          </div>

          {/* Invoice Details */}
          <div className="w-full md:w-80 space-y-4">
            <div className="flex items-center justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right">Invoice number</label>
              <input value="Auto-generated" disabled className={`${inputClass} w-48 bg-slate-50 text-slate-400 cursor-not-allowed`} />
            </div>
            <div className="flex items-center justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right">P.O./S.O. number</label>
              <input value={poSoNumber} onChange={e => setPoSoNumber(e.target.value)} className={`${inputClass} w-48`} />
            </div>
            <div className="flex items-center justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right">Invoice date</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={`${inputClass} w-48`} />
            </div>
            <div className="flex items-start justify-end gap-3">
              <label className="text-sm font-medium text-slate-600 w-32 text-right pt-2">Payment due</label>
              <div className="w-48">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
                <p className="text-xs text-slate-500 mt-1">Leave blank for due on receipt</p>
              </div>
            </div>
          </div>
        </div>

        {/* LINE ITEMS */}
        <div className="bg-slate-50 border-y border-slate-200 -mx-4 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-200">
              <div className="col-span-6">Items</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            <div className="bg-white">
              {lineItems.map((line, i) => {
                const { base, resolvedTaxes } = calcLine(line);
                return (
                  <div key={i} className="border-b border-slate-100">
                    <div className="grid grid-cols-12 gap-4 px-4 pt-4 pb-2 items-center">
                      <div className="col-span-6">
                        <select
                          value={line.description}
                          onChange={e => selectCatalogueItem(i, e.target.value)}
                          className="w-full text-slate-800 font-medium bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-0 py-1 transition-colors outline-none cursor-pointer"
                        >
                          <option value="">Select an item</option>
                          {items.map(item => (
                            <option key={item.id} value={item.name}>{item.name}</option>
                          ))}
                        </select>
                        {line.description && !items.find(it => it.name === line.description) && (
                          <input
                            value={line.description}
                            onChange={e => updateLine(i, 'description', e.target.value)}
                            placeholder="Description"
                            className="w-full mt-1 text-sm text-slate-600 border-0 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-0 py-1 outline-none"
                          />
                        )}
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="any" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} className={inputClass} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} className={inputClass} />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-3">
                        <span className="font-medium text-slate-800">{fmt(base)}</span>
                        <button type="button" onClick={() => removeLine(i)} className="text-blue-500 hover:text-red-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {resolvedTaxes.map((tax, tIndex) => (
                      <div key={tIndex} className="grid grid-cols-12 gap-4 px-4 py-1 items-center">
                        <div className="col-span-6" />
                        <div className="col-span-2 flex items-center gap-1">
                          <input
                            value={tax.name}
                            onChange={e => updateLineTax(i, tIndex, 'name', e.target.value)}
                            placeholder="Tax name"
                            className="w-16 text-xs border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-500"
                          />
                          <input
                            type="number" min="0" max="100"
                            value={tax.percent}
                            onChange={e => updateLineTax(i, tIndex, 'percent', e.target.value)}
                            className="w-14 text-xs border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-blue-500"
                          />
                          <span className="text-xs text-slate-400">%</span>
                          <button type="button" onClick={() => removeLineTax(i, tIndex)} className="text-slate-300 hover:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>
                        </div>
                        <div className="col-span-2" />
                        <div className="col-span-2 text-right pr-7">
                          <span className="text-sm text-slate-500">{fmt(tax.amount)}</span>
                        </div>
                      </div>
                    ))}

                    <div className="px-4 pb-3">
                      <button type="button" onClick={() => addTaxToLine(i)} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5 cursor-pointer">
                        <Plus className="w-3 h-3" /> add a tax
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-4 bg-white border-b border-slate-200">
              <button type="button" onClick={addLine} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 cursor-pointer">
                <Plus className="w-4 h-4" /> Add an item
              </button>
            </div>
          </div>
        </div>

        {/* TOTALS */}
        <div className="flex justify-end mt-8">
          <div className="w-full md:w-80 space-y-3 pt-4">
            <div className="flex justify-between items-center text-sm text-slate-700">
              <span>Items</span>
              <span>{fmt(itemsBase)}</span>
            </div>

            {Object.values(taxBreakdown).map((tax, idx) => (
              <div key={idx} className="flex justify-between text-sm text-slate-700">
                <span className="text-slate-500">{tax.name} ({tax.percent}%)</span>
                <span>{fmt(tax.amount)}</span>
              </div>
            ))}

            <div className="flex justify-between items-center text-sm font-semibold text-slate-700 pt-2 border-t border-slate-100">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>

            {discountAdded ? (
              <div className="flex justify-between items-center text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" max="100"
                    value={discountPercent}
                    onChange={e => setDiscountPercent(e.target.value)}
                    className="w-16 border border-slate-200 rounded px-2 py-1 text-right outline-none focus:border-blue-500"
                  />
                  <span className="text-slate-500">% discount</span>
                  <button type="button" onClick={() => { setDiscountAdded(false); setDiscountPercent('0'); }} className="text-slate-300 hover:text-red-400 ml-1 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-slate-500">-{fmt(discountAmount)}</span>
              </div>
            ) : (
              <button type="button" onClick={() => setDiscountAdded(true)} className="text-left text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Add a discount
              </button>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-600 pt-1">
              <input type="checkbox" checked={taxExempt} onChange={e => setTaxExempt(e.target.checked)} className="rounded border-slate-300" />
              Tax exempt
            </label>

            <div className="flex justify-between items-center font-bold text-slate-800 pt-3 border-t border-slate-200">
              <span>Total</span>
              <div className="flex items-center gap-4">
                <span className="text-sm px-3 py-1 bg-slate-100 text-slate-500 rounded border border-slate-200 font-normal">
                  {currency}
                </span>
                <span className="text-lg">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="w-full md:w-1/2 space-y-6 mt-8">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Payment Terms</label>
            <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" className={`${inputClass} mt-2`} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter notes or terms of service..." className={`${inputClass} mt-2 h-24 resize-none`} />
          </div>
        </div>

        {/* Actions */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-4 z-40">
          <button type="button" onClick={() => router.push('/invoices')} className="px-6 py-2 rounded-md font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="px-8 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Invoice
          </button>
        </div>
      </form>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {customerModalStep !== 'choice' && (
                  <button type="button" onClick={() => setCustomerModalStep('choice')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-xl font-bold text-slate-800">
                  {customerModalStep === 'choice' && 'Add a customer'}
                  {customerModalStep === 'new' && 'New customer'}
                  {customerModalStep === 'existing' && 'Choose existing customer'}
                </h2>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {customerModalStep === 'choice' && (
              <div className="p-8 space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase">Select existing customer</label>
                  <select
                    value={existingCustomerId}
                    onChange={e => {
                      setExistingCustomerId(e.target.value);
                      if (e.target.value) {
                        const c = customers.find(x => x.id === e.target.value);
                        if (c) { setSelectedCustomer(c); setCustomerId(c.id); setShowCustomerModal(false); }
                      }
                    }}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="">— choose a customer —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customer_name}{c.company_name ? ` — ${c.company_name}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">or</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCustomerForm({ customer_code: '', customer_type: 'business', customer_name: '', company_name: '', email: '', phone: '', billing_address_1: '', billing_address_2: '', city: '', state: '', postal_code: '', country: 'IN', currency: 'INR', gstin: '', pan: '', registration_number: '' });
                    setCurrencyManuallySet(false);
                    setCustomerModalStep('new');
                  }}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 py-5 transition-all cursor-pointer text-slate-600 hover:text-blue-600"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">New customer</p>
                    <p className="text-xs text-slate-400">Create and add a brand new customer</p>
                  </div>
                </button>
              </div>
            )}

            {customerModalStep === 'new' && (
              <form onSubmit={handleCreateCustomer} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Customer Type</label>
                    <select name="customer_type" value={customerForm.customer_type} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`}>
                      <option value="business">Business</option>
                      <option value="individual">Individual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Customer Code</label>
                    <input name="customer_code" value={customerForm.customer_code} onChange={handleCustomerFormChange} placeholder="e.g. CUST-001" className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Contact Name *</label>
                    <input name="customer_name" value={customerForm.customer_name} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`} required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Company Name</label>
                    <input name="company_name" value={customerForm.company_name} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Email</label>
                    <input name="email" type="email" value={customerForm.email} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Phone</label>
                    <input name="phone" value={customerForm.phone} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase">Currency</label>
                    <select name="currency" value={customerForm.currency} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`}>
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-700 mb-4">Billing Address</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2"><input name="billing_address_1" value={customerForm.billing_address_1} onChange={handleCustomerFormChange} placeholder="Address Line 1" className={inputClass} /></div>
                    <div className="col-span-2"><input name="billing_address_2" value={customerForm.billing_address_2} onChange={handleCustomerFormChange} placeholder="Address Line 2" className={inputClass} /></div>
                    <div><input name="city" value={customerForm.city} onChange={handleCustomerFormChange} placeholder="City" className={inputClass} /></div>
                    <div><input name="state" value={customerForm.state} onChange={handleCustomerFormChange} placeholder="State / Province" className={inputClass} /></div>
                    <div><input name="postal_code" value={customerForm.postal_code} onChange={handleCustomerFormChange} placeholder="Postal Code" className={inputClass} /></div>
                    <div>
                      <select name="country" value={customerForm.country} onChange={handleCustomerFormChange} className={inputClass}>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <h3 className="font-bold text-slate-700 mb-4">Tax Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">GSTIN / Tax ID</label>
                      <input name="gstin" value={customerForm.gstin} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">PAN</label>
                      <input name="pan" value={customerForm.pan} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Registration No.</label>
                      <input name="registration_number" value={customerForm.registration_number} onChange={handleCustomerFormChange} className={`${inputClass} mt-1`} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCustomerModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={savingCustomer} className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 flex items-center gap-2 cursor-pointer disabled:opacity-60">
                    {savingCustomer && <Loader2 className="w-4 h-4 animate-spin" />} Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}