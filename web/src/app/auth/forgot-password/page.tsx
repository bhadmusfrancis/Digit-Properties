'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setMessage('');
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('sent');
        setMessage(data.message || 'If an account exists with this email, you will receive a password reset link.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setMessage('Network error');
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
      <p className="mt-2 text-gray-600">
        Enter your email and we will send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="input mt-1 w-full"
            disabled={status === 'sent'}
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending'}
          className="btn-primary w-full"
        >
          {status === 'sending' ? 'Sending…' : 'Send reset link'}
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
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
