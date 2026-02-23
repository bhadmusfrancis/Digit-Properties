'use client';

import { useState, Suspense, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  useEffect(() => {
    if (searchParams.get('verified') === '1') setSuccess('Your email is verified. You can sign in now.');
  }, [searchParams]);

  const verificationError = searchParams.get('error');
  const isVerificationError = verificationError === 'InvalidOrExpired' || verificationError === 'InvalidVerification' || verificationError === 'VerificationFailed';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      const msg = typeof res.error === 'string' ? res.error : '';
      setError(msg === 'CredentialsSignin' ? 'Invalid Credentials' : msg || 'Invalid Credentials');
      return;
    }
    if (res?.ok) window.location.href = callbackUrl;
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
      <p className="mt-2 text-gray-600">Sign in to view contact details and manage your listings.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {success && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {success}
          </div>
        )}
        {isVerificationError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            That verification link is invalid or expired.{' '}
            <Link href="/auth/resend-verification" className="font-medium text-primary-600 underline">
              Send a new verification email
            </Link>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input mt-1"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6">
        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-primary-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>

      <SocialAuthButtons callbackUrl={callbackUrl} />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}
