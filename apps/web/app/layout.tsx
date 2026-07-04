import type { Metadata } from 'next';
//import './globals.css'; // keep this line only if you actually have a globals.css — remove if not

export const metadata: Metadata = {
  title: 'FinOps',
  description: 'Accounts Payable & Procurement',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}