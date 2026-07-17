'use client';

import dynamic from 'next/dynamic';
import type { ListingFormProps } from '@/components/listings/ListingForm';

const ListingForm = dynamic(
  () => import('@/components/listings/ListingForm').then((m) => m.ListingForm),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4" aria-busy="true" aria-label="Loading editor">
        <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    ),
  }
);

/** Client-only listing editor — avoids SSR crashes from TipTap / maps / media UI. */
export function EditListingFormLoader(props: ListingFormProps) {
  return <ListingForm {...props} />;
}
