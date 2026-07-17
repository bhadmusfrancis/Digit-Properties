'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function EditListingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[EditListing error]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Unable to open editor</h1>
      <p className="mt-2 text-gray-600">
        Sign in as an admin (or the listing owner within the edit window), then try again. This is not
        caused by ads.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/auth/signin" className="btn-secondary">
          Sign in
        </Link>
        <Link href="/admin/listings" className="btn-secondary">
          Admin listings
        </Link>
      </div>
    </div>
  );
}
