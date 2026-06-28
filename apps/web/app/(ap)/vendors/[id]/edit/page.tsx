'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { vendorsService } from '@/services/ap';
import type { Vendor } from '@/types/ap';
import VendorForm from '../../../../../components/ap/vendorForm';

export default function EditVendorPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vendorsService.getOne(id)
      .then(setVendor)
      .catch(() => toast.error('Failed to load vendor'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  if (!vendor) return <div className="p-6 text-slate-500">Vendor not found.</div>;

  return <VendorForm vendor={vendor} />;
}