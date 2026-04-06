'use client';

import { useState, Suspense, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SocialAuthButtons from '@/components/auth/SocialAuthButtons';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';
const CAPTCHA_CONTAINER_ID = 'signup-recaptcha-container';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (container: string | HTMLElement, options: { sitekey: string; callback?: (token: string) => void; theme?: string; size?: string }) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
    };
    onRecaptchaSignupLoad?: () => void;
  }
}

function SignUpForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(!RECAPTCHA_SITE_KEY);
  const captchaWidgetId = useRef<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || typeof window === 'undefined') return;
    const renderWidget = () => {
      const el = document.getElementById(CAPTCHA_CONTAINER_ID);
      if (!el || el.hasChildNodes()) {
        setCaptchaReady(true);
        return;
      }
      window.grecaptcha?.ready(() => {
        if (!el.hasChildNodes()) {
          captchaWidgetId.current = window.grecaptcha!.render(el, {
            sitekey: RECAPTCHA_SITE_KEY,
            theme: 'light',
            size: 'normal',
          });
        }
        setCaptchaReady(true);
      });
    };
    if (window.grecaptcha) {
      renderWidget();
      return;
    }
    window.onRecaptchaSignupLoad = () => renderWidget();
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaSignupLoad&render=explicit';
    script.async = true;
    script.defer = true;
    script.onerror = () => setCaptchaReady(true);
    document.head.appendChild(script);
    return () => {
      delete window.onRecaptchaSignupLoad;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!acceptTerms) {
      setError('You must accept the Terms of Service and Privacy Policy to sign up.');
      return;
    }
    if (!captchaReady) return;
    if (RECAPTCHA_SITE_KEY && window.grecaptcha && captchaWidgetId.current !== null) {
      const token = window.grecaptcha.getResponse(captchaWidgetId.current);
      if (!token) {
        setError('Please complete the "I\'m not a robot" check.');
        return;
      }
    }
    setLoading(true);
    try {
      let captchaToken = '';
      if (RECAPTCHA_SITE_KEY && window.grecaptcha && captchaWidgetId.current !== null) {
        captchaToken = window.grecaptcha.getResponse(captchaWidgetId.current);
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, website, captchaToken, acceptTermsAndPrivacy: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error;
        setError(typeof err === 'object' ? 'Invalid input' : err?.message || err || 'Registration failed');
        if (RECAPTCHA_SITE_KEY && window.grecaptcha && captchaWidgetId.current !== null) {
          window.grecaptcha.reset(captchaWidgetId.current);
        }
        setLoading(false);
        return;
      }
      if (data.needVerification) {
        router.push(`/auth/verify-required?email=${encodeURIComponent(data.email || email)}`);
        setLoading(false);
        return;
      }
      const signInRes = await signIn('credentials', { email, password, redirect: false });
      if (signInRes?.ok) router.push(callbackUrl);
      else if (signInRes?.error) setError(signInRes.error === 'CredentialsSignin' ? 'Invalid Credentials' : signInRes.error);
      else router.push('/auth/signin');
    } catch {
      setError('Registration failed');
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
      <p className="mt-2 text-gray-600">Sign up to list properties and unlock your dashboard.</p>

      <SocialAuthButtons callbackUrl={callbackUrl} />

      <p className="mt-6 text-center text-sm text-gray-500">or sign up with email</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
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
        <div className="flex items-start gap-3">
          <input
            id="acceptTerms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            aria-describedby="acceptTerms-desc"
          />
          <label id="acceptTerms-desc" htmlFor="acceptTerms" className="text-sm text-gray-700">
            I agree to the{' '}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">
              Privacy Policy
            </Link>
            . You must accept both to create an account.
          </label>
        </div>
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        {RECAPTCHA_SITE_KEY && (
          <div className="flex flex-col gap-1">
            <div id={CAPTCHA_CONTAINER_ID} className="min-h-[78px]" />
            <p className="text-xs text-gray-500">
              This site is protected by reCAPTCHA. Google Privacy Policy and Terms apply.
            </p>
          </div>
        )}
        <button type="submit" disabled={loading || !captchaReady || !acceptTerms} className="btn-primary w-full">
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

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
