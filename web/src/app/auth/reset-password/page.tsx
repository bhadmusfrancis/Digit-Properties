'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const PASSWORD_HINT = 'At least 8 characters, with uppercase, lowercase, and a number';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }
    if (!token) {
      setError('Invalid reset link. Request a new one from the sign-in page.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/auth/signin?reset=1'), 2000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
        <p className="text-gray-700">This reset link is invalid or missing. Please request a new one.</p>
        <Link href="/auth/forgot-password" className="mt-4 font-medium text-primary-600 hover:underline">
          Request new reset link
        </Link>
        <Link href="/auth/signin" className="mt-2 font-medium text-primary-600 hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
        <div className="rounded-lg bg-emerald-50 p-6 text-emerald-800">
          <p className="font-medium">Password updated.</p>
          <p className="mt-1 text-sm">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
      <p className="mt-2 text-gray-600">Enter your new password below.</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            className="input mt-1 w-full"
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">{PASSWORD_HINT}</p>
        </div>
        <div>
          <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-700">
            Confirm password
          </label>
          <input
            id="reset-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            className="input mt-1 w-full"
            disabled={loading}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        <Link href="/auth/signin" className="font-medium text-primary-600 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
