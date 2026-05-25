'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { LISTING_CLAIM_EDIT_NOTICE } from '@/lib/listing-edit-window';

export default function ClaimsPage() {
  const { data: claims, isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => fetch('/api/claims').then((r) => r.json()),
  });

  const list = Array.isArray(claims) ? claims : [];

  return (
    <div className="min-w-0">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">My Claims</h1>
      <p className="mt-1 text-gray-600">Track your property ownership claims.</p>
      <p className="mt-3 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
        {LISTING_CLAIM_EDIT_NOTICE}
      </p>
      {isLoading ? (
        <div className="mt-6 h-48 animate-pulse rounded bg-gray-100" />
      ) : (
        <div className="mt-6 space-y-4">
          {list.map((c: { _id: string; status: string; listingId?: { _id: string; title?: string } }) => (
            <div key={c._id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div>
                <Link
                  href={c.listingId ? `/listings/${c.listingId._id || c.listingId}` : '#'}
                  className="line-clamp-2 font-medium text-primary-600 hover:underline"
                >
                  {typeof c.listingId === 'object' && c.listingId?.title
                    ? c.listingId.title
                    : 'Listing'}
                </Link>
                <p className="text-sm text-gray-500">
                  Status:{' '}
                  <span
                    className={
                      c.status === 'approved'
                        ? 'text-green-600'
                        : c.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }
                  >
                    {c.status}
                  </span>
                </p>
                {c.status === 'approved' && c.listingId && (
                  <p className="mt-2 text-sm text-gray-600">
                    <Link
                      href={`/listings/${typeof c.listingId === 'object' ? c.listingId._id : c.listingId}/edit`}
                      className="font-medium text-primary-600 hover:underline"
                    >
                      Edit listing
                    </Link>
                    <span className="text-gray-500"> (within 24 hours of claim)</span>
                  </p>
                )}
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center text-gray-500">
              No claims yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
