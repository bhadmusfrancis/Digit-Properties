'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDbError =
    error?.message?.includes('ECONNREFUSED') ||
    error?.message?.toLowerCase().includes('mongodb') ||
    error?.message?.includes('querySrv');

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-gray-900">
        {isDbError ? 'Database connection unavailable' : 'Something went wrong'}
      </h1>
      <p className="mt-2 text-gray-600">
        {isDbError ? (
          <>
            The app could not reach the database. Check your internet connection and that{' '}
            <code className="rounded bg-gray-100 px-1 text-sm">MONGODB_URI</code> in{' '}
            <code className="rounded bg-gray-100 px-1 text-sm">.env.local</code> is correct. If using MongoDB Atlas,
            ensure your IP is allowed and the cluster is running.
          </>
        ) : (
          'A temporary error occurred. Try again or go back home.'
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
