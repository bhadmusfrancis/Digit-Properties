'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

export default function ClaimsPage() {
  const { data: claims, isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => fetch('/api/claims').then((r) => r.json()),
  });

  const list = Array.isArray(claims) ? claims : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">My Claims</h1>
      <p className="mt-1 text-gray-600">Track your property ownership claims.</p>
      {isLoading ? (
        <div className="mt-6 h-48 animate-pulse rounded bg-gray-100" />
      ) : (
        <div className="mt-6 space-y-4">
          {list.map((c: { _id: string; status: string; listingId?: { _id: string; title?: string } }) => (
            <div
              key={c._id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div>
                <Link
                  href={c.listingId ? `/listings/${c.listingId._id || c.listingId}` : '#'}
                  className="font-medium text-primary-600 hover:underline"
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
