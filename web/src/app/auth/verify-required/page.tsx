'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerifyRequiredContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState('');

  const handleResend = async () => {
    const email = emailParam.trim();
    if (!email) {
      setResendError('Email missing. Use the sign-in page to request a new verification link.');
      return;
    }
    setResendError('');
    setResendStatus('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendStatus('sent');
      } else {
        setResendStatus('error');
        setResendError(data.error || 'Failed to resend');
      }
    } catch {
      setResendStatus('error');
      setResendError('Network error');
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
        <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-gray-700">
          We sent a verification link to {emailParam ? <strong>{emailParam}</strong> : 'your email'}. Click the link to verify your account and then sign in.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          The link expires in 24 hours. If you don&apos;t see the email, check your spam folder.
        </p>
        {emailParam && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendStatus === 'sending'}
              className="text-sm font-medium text-primary-600 hover:underline disabled:opacity-50"
            >
              {resendStatus === 'sending' ? 'Sending…' : resendStatus === 'sent' ? 'Sent! Check your email.' : "Didn't get it? Resend verification email"}
            </button>
            {resendError && <p className="mt-1 text-sm text-red-600">{resendError}</p>}
          </div>
        )}
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
