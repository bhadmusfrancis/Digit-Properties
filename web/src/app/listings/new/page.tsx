'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { ListingForm } from '@/components/listings/ListingForm';

export default function NewListingPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!session) {
    redirect('/auth/signin?callbackUrl=/listings/new');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">List a property</h1>
      <ListingForm />
    </div>
  );
}
