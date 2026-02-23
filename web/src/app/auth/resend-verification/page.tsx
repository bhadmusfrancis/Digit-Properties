'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResendVerificationForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setMessage('');
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('sent');
        setMessage(data.message || 'Verification email sent. Check your inbox and spam folder.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Request failed');
      }
    } catch {
      setStatus('error');
      setMessage('Network error');
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900">Resend verification email</h1>
      <p className="mt-2 text-gray-600">
        Enter the email you used to sign up. We&apos;ll send a new verification link (valid 24 hours).
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="resend-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="resend-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="input mt-1 w-full"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="btn-primary w-full"
        >
          {status === 'sending' ? 'Sending…' : 'Send verification email'}
        </button>
        {message && (
          <p
            className={`text-sm ${
              status === 'error' ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {message}
          </p>
        )}
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        <Link href="/auth/signin" className="font-medium text-primary-600 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResendVerificationPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">Loading...</div>}>
      <ResendVerificationForm />
    </Suspense>
  );
}
