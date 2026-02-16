'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

function SignUpForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }
      const signInRes = await signIn('credentials', { email, password, redirect: false });
      if (signInRes?.ok) router.push(callbackUrl);
      else router.push('/auth/signin');
    } catch {
      setError('Registration failed');
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
      <p className="mt-2 text-gray-600">Sign up to list properties and view contact details.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Full name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input mt-1"
          />
        </div>
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
            Password (min 8 chars, include uppercase, lowercase, number)
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="input mt-1"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <SocialAuthButtons callbackUrl={callbackUrl} />

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/auth/signin" className="font-medium text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">Loading...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
