'use client';

import { useState, useCallback } from 'react';
import { stripHtml } from '@/lib/utils';

export type SocialShareButtonsProps = {
  url: string;
  title: string;
  /** Optional short text for tweet / WhatsApp (e.g. excerpt). Falls back to title. */
  text?: string;
  className?: string;
};

const encoded = (s: string) => encodeURIComponent(s);

/**
 * Absolute https URL for sharing. Prefer NEXT_PUBLIC_APP_URL for relative paths so previews match
 * Open Graph tags and work on staging/preview hosts.
 */
function getAbsoluteShareUrl(raw: string): string {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  const path = t.startsWith('/') ? t : `/${t}`;
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    try {
      return `${new URL(env).origin}${path}`;
    } catch {
      /* ignore */
    }
  }
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

/**
 * Meta's Share Dialog `redirect_uri` must match Valid OAuth Redirect URIs exactly.
 * Prefer NEXT_PUBLIC_APP_URL so production matches Vercel/env even when users hit www or another host.
 */
function facebookShareRedirectOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/** Fallback when no App ID; m-dot sharer tends to preserve `u=` through redirects. */
function facebookMobileSharerUrl(pageUrlAbs: string): string {
  return `https://m.facebook.com/sharer.php?u=${encoded(pageUrlAbs)}`;
}

function isIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

/** Third‑party browsers on iOS (all use WebKit); Meta’s `display=touch` dialog often breaks here — use full-page `page`. */
function isIOSNonSafariBrowser(ua: string): boolean {
  return isIOS(ua) && /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

/**
 * Meta Share Dialog: `touch` on mobile Safari/Android; `page` on iOS Chrome / Firefox / Edge / Opera.
 * No website can reliably force the native Facebook app; universal links may open the app after navigating to facebook.com.
 */
function facebookMobileDialogDisplay(ua: string): 'touch' | 'page' {
  if (isIOSNonSafariBrowser(ua)) return 'page';
  return 'touch';
}

/**
 * Link-only share so Facebook attaches a link preview (Open Graph title/description/image), not a text post with a naked URL.
 * Do not send `quote` — it becomes user-visible text above the link and works against the “card” experience.
 */
function facebookHrefForLinkPreview(abs: string): string {
  try {
    const u = new URL(abs);
    u.hash = '';
    return u.toString();
  } catch {
    return abs;
  }
}

function buildFacebookShareDialogUrl(opts: {
  appId: string;
  display: 'touch' | 'page' | 'popup';
  hrefAbsolute: string;
  redirectUriRaw: string;
}): string {
  const q = new URLSearchParams();
  q.set('app_id', opts.appId);
  q.set('display', opts.display);
  q.set('href', opts.hrefAbsolute);
  q.set('redirect_uri', opts.redirectUriRaw);
  return `https://www.facebook.com/dialog/share?${q.toString()}`;
}

function openFacebookShare(pageUrl: string, _shareTitle: string, _shareSnippet: string): void {
  const abs = facebookHrefForLinkPreview(getAbsoluteShareUrl(pageUrl));
  const hrefEnc = encoded(abs);
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim();

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const mobileUa = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  if (appId && typeof window !== 'undefined') {
    const origin = facebookShareRedirectOrigin();
    const redirectUriRaw = origin ? `${origin}/` : `${window.location.origin}/`;

    if (mobileUa) {
      const display = facebookMobileDialogDisplay(ua);
      const dialogUrl = buildFacebookShareDialogUrl({
        appId,
        display,
        hrefAbsolute: abs,
        redirectUriRaw,
      });
      window.location.assign(dialogUrl);
      return;
    }

    const dialogUrl = buildFacebookShareDialogUrl({
      appId,
      display: 'popup',
      hrefAbsolute: abs,
      redirectUriRaw,
    });
    const w = window.open(dialogUrl, '_blank', 'noopener,noreferrer,width=626,height=600,scrollbars=yes');
    if (w) w.opener = null;
    return;
  }

  if (mobileUa && typeof window !== 'undefined') {
    window.location.assign(facebookMobileSharerUrl(abs));
    return;
  }

  const sharer = `https://www.facebook.com/sharer/sharer.php?u=${hrefEnc}`;
  const popup = window.open(sharer, '_blank', 'noopener,noreferrer,width=626,height=436,scrollbars=yes');
  if (popup) popup.opener = null;
}

export function SocialShareButtons({ url, title, text, className = '' }: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const safeTitle = stripHtml(title).trim() || title;
  const fromText = text?.trim() ? stripHtml(text).trim() : '';
  const shareText = (fromText || safeTitle).trim() || title;

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?url=${encoded(url)}&text=${encoded(shareText)}`,
    whatsapp: `https://wa.me/?text=${encoded(shareText + ' ' + url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded(url)}`,
  };

  const copyUrlAbsolute = useCallback(() => getAbsoluteShareUrl(url), [url]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyUrlAbsolute());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [copyUrlAbsolute]);

  const label = 'Share';
  const baseButtonClass =
    'inline-flex items-center justify-center gap-2.5 rounded-xl border-2 bg-white px-4 py-3 text-base font-semibold shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[52px] min-w-[52px] sm:min-w-0';

  return (
    <div className={className}>
      <span className="mb-3 block text-base font-bold tracking-tight text-slate-800">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={shareUrls.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className={`${baseButtonClass} border-slate-200 text-slate-700 hover:border-slate-800 hover:bg-slate-800 hover:text-white hover:shadow-lg focus:ring-slate-600`}
          aria-label="Share on X (Twitter)"
        >
          <XIcon className="h-6 w-6 shrink-0" />
          <span className="hidden sm:inline">X</span>
        </a>
        <button
          type="button"
          onClick={() => openFacebookShare(url, safeTitle, shareText)}
          className={`${baseButtonClass} border-slate-200 text-slate-700 hover:border-[#1877f2] hover:bg-[#1877f2] hover:text-white hover:shadow-lg focus:ring-[#1877f2]`}
          aria-label="Share on Facebook"
        >
          <FacebookIcon className="h-6 w-6 shrink-0" />
          <span className="hidden sm:inline">Facebook</span>
        </button>
        <a
          href={shareUrls.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={`${baseButtonClass} border-slate-200 text-slate-700 hover:border-[#25d366] hover:bg-[#25d366] hover:text-white hover:shadow-lg focus:ring-[#25d366]`}
          aria-label="Share on WhatsApp"
        >
          <WhatsAppIcon className="h-6 w-6 shrink-0" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
        <a
          href={shareUrls.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className={`${baseButtonClass} border-slate-200 text-slate-700 hover:border-[#0a66c2] hover:bg-[#0a66c2] hover:text-white hover:shadow-lg focus:ring-[#0a66c2]`}
          aria-label="Share on LinkedIn"
        >
          <LinkedInIcon className="h-6 w-6 shrink-0" />
          <span className="hidden sm:inline">LinkedIn</span>
        </a>
        <button
          type="button"
          onClick={copyLink}
          className={`${baseButtonClass} border-slate-200 text-slate-700 hover:border-primary-500 hover:bg-primary-500 hover:text-white hover:shadow-lg focus:ring-primary-500`}
          aria-label="Copy link"
        >
          {copied ? (
            <CheckIcon className="h-6 w-6 shrink-0 text-green-600" />
          ) : (
            <LinkIcon className="h-6 w-6 shrink-0" />
          )}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy link'}</span>
        </button>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
