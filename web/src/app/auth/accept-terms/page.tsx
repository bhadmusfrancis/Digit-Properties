'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function AcceptTermsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/me/accept-legal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
    } catch {
      setError('Request failed');
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col justify-center px-4 py-12">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Accept Terms & Privacy Policy</h1>
        <p className="mt-4 text-gray-600">
          To continue using your account, you must accept our Terms of Service and Privacy Policy. These explain how we
          provide the platform and how we handle your data.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-6 text-gray-600">
          <li>
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Terms of Service
            </Link>
          </li>
          <li>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Privacy Policy
            </Link>
          </li>
        </ul>
        <p className="mt-6 text-sm text-gray-500">
          By clicking &quot;I accept&quot; below, you agree to the Terms of Service and Privacy Policy.
        </p>
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading}
          className="btn-primary mt-6 w-full"
        >
          {loading ? 'Processing…' : 'I accept the Terms of Service and Privacy Policy'}
        </button>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href="/api/auth/signout" className="text-primary-600 hover:underline">
            Sign out
          </Link>
          {' '}if you do not wish to accept.
        </p>
      </div>
    </div>
  );
}

export default function AcceptTermsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[80vh] items-center justify-center">Loading…</div>}>
      <AcceptTermsContent />
    </Suspense>
  );
}
