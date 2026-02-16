'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ListingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ListingDetail error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Unable to load listing</h1>
      <p className="mt-2 text-gray-600">
        Something went wrong. The listing may not exist or there was a temporary error.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/listings" className="btn-secondary">
          Back to listings
        </Link>
      </div>
    </div>
  );
}
