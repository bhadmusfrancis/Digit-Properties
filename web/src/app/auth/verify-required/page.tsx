'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerifyRequiredContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-gray-700">
          We sent a verification link to {email ? <strong>{email}</strong> : 'your email'}. Click the link to verify your account and then sign in.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          The link expires in 24 hours. If you don&apos;t see the email, check your spam folder.
        </p>
        <Link
          href="/auth/signin"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-4 py-2.5 text-center font-medium text-white hover:bg-primary-700"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyRequiredPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">Loading...</div>}>
      <VerifyRequiredContent />
    </Suspense>
  );
}
