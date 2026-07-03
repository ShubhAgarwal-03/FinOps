import Link from 'next/link';

const links = [
  { href: '/requisitions/new', label: 'New Requisition' },
  { href: '/purchase-orders/new', label: 'New Purchase Order' },
  { href: '/grn/new', label: 'New GRN' },
  { href: '/vendor-invoices/new', label: 'New Vendor Invoice' },
  // add more as pages get built
];

export default function Home() {
  return (
    <div className="p-8 max-w-md mx-auto space-y-3">
      <h1 className="text-xl font-bold mb-4">FinOps</h1>
      {links.map(l => (
        <Link key={l.href} href={l.href} className="block px-4 py-3 border rounded-md hover:bg-slate-50">
          {l.label}
        </Link>
      ))}
    </div>
  );
}