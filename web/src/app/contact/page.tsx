'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';
const CAPTCHA_CONTAINER_ID = 'contact-recaptcha-container';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (container: string | HTMLElement, options: { sitekey: string; callback?: (token: string) => void; theme?: string; size?: string }) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
    };
    onRecaptchaContactLoad?: () => void;
  }
}

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [captchaReady, setCaptchaReady] = useState(!RECAPTCHA_SITE_KEY);
  const captchaWidgetId = useRef<number | null>(null);
  const captchaContainerRef = useRef<HTMLDivElement>(null);

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
    window.onRecaptchaContactLoad = () => renderWidget();
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaContactLoad&render=explicit';
    script.async = true;
    script.defer = true;
    script.onerror = () => setCaptchaReady(true);
    document.head.appendChild(script);
    return () => {
      delete window.onRecaptchaContactLoad;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaReady) return;
    setStatus('sending');
    setErrorMessage('');
    try {
      let captchaToken = '';
      if (RECAPTCHA_SITE_KEY && window.grecaptcha && captchaWidgetId.current !== null) {
        captchaToken = window.grecaptcha.getResponse(captchaWidgetId.current);
        if (!captchaToken) {
          setErrorMessage('Please complete the "I\'m not a robot" check.');
          setStatus('error');
          return;
        }
      }
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, captchaToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('sent');
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
        if (RECAPTCHA_SITE_KEY && window.grecaptcha && captchaWidgetId.current !== null) {
          window.grecaptcha.reset(captchaWidgetId.current);
        }
      } else {
        setStatus('error');
        setErrorMessage(data?.error || 'Something went wrong.');
        if (RECAPTCHA_SITE_KEY && window.grecaptcha && captchaWidgetId.current !== null) {
          window.grecaptcha.reset(captchaWidgetId.current);
        }
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">Contact us</h1>
      <p className="mt-2 text-gray-600">
        Send us a message and we&apos;ll get back to you as soon as we can.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700">Subject</label>
          <input
            id="subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input mt-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
          <textarea
            id="message"
            rows={5}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input mt-1 w-full"
          />
        </div>
        <div className="space-y-2">
          <div id={CAPTCHA_CONTAINER_ID} ref={captchaContainerRef} className="min-h-[78px]" />
          {RECAPTCHA_SITE_KEY ? (
            <p className="text-xs text-gray-500">
              This site is protected by reCAPTCHA. Google Privacy Policy and Terms apply.
            </p>
          ) : (
            <p className="text-xs text-amber-600">
              reCAPTCHA is not configured. Add <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_RECAPTCHA_SITE_KEY</code> to <code className="bg-amber-100 px-1 rounded">.env.local</code> (reCAPTCHA v2 Checkbox key), then restart the dev server.
            </p>
          )}
        </div>
        {status === 'sent' && (
          <p className="text-sm text-green-600">Message sent. We&apos;ll be in touch.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-600">{errorMessage || 'Something went wrong. Please try again.'}</p>
        )}
        <button type="submit" disabled={status === 'sending' || !captchaReady} className="btn-primary w-full">
          {status === 'sending' ? 'Sending...' : 'Send message'}
        </button>
      </form>
      <p className="mt-8">
        <Link href="/" className="text-primary-600 hover:underline">← Back to home</Link>
      </p>
    </div>
  );
}
