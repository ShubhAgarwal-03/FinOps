import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import Sidebar from '@/components/layout/sidebar';
import './globals.css';


export const metadata: Metadata = {
  title: 'FinOps Platform',
  description: 'Procurement and invoicing, end to end',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar />
          {/* No padding here on purpose — every page already wraps its own
              content in `max-w-* mx-auto py-8 px-4`, so double-padding would
              throw off the max-width centering. */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}