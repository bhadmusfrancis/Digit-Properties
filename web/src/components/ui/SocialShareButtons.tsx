'use client';

import { useCallback } from 'react';
import { stripHtml } from '@/lib/utils';

export type SocialShareButtonsProps = {
  url: string;
  title: string;
  /** Optional short text for tweet / WhatsApp (e.g. excerpt). Falls back to title. */
  text?: string;
  /** Optional first media (image/video) to share as file when platform supports native file sharing. */
  mediaUrl?: string;
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
 * Normalize share target so Facebook’s crawler matches Open Graph (`og:url`) — strip hash only.
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

const FB_POPUP_FEATURES = 'noopener,noreferrer,width=626,height=436,scrollbars=yes';

function openFacebookSharerPopup(href: string): void {
  const w = window.open(href, '_blank', FB_POPUP_FEATURES);
  if (w) w.opener = null;
}

/**
 * No Share Dialog / app_id: avoids “User opted out of Facebook platform” when users disable Apps & Websites.
 *
 * - **iOS (incl. Chrome)**: `navigator.share({ url })` first so the URL is passed into Facebook correctly; opening
 *   m.facebook in-page often universal-links into the FB app and drops `u`.
 * - **Firefox (desktop)**: `www` sharer can redirect into a platform flow; use **m.facebook** sharer in a popup.
 * - **Android**: full navigation to m.facebook keeps `u=` reliably.
 */
async function openFacebookShare(pageUrl: string, _shareTitle: string, _shareSnippet: string): Promise<void> {
  const abs = facebookHrefForLinkPreview(getAbsoluteShareUrl(pageUrl));
  const u = encoded(abs);
  const sharerWww = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
  const sharerM = `https://m.facebook.com/sharer.php?u=${u}`;

  if (typeof window === 'undefined') return;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isFirefoxDesktop = /\bFirefox\//i.test(ua) && !/Android|iPhone|iPad|iPod/i.test(ua);
  const mobileUa = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  if (isIOS && typeof navigator.share === 'function') {
    try {
      const can = typeof navigator.canShare !== 'function' || navigator.canShare({ url: abs });
      if (can) {
        await navigator.share({ url: abs });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
    }
  }

  if (isFirefoxDesktop) {
    openFacebookSharerPopup(sharerM);
    return;
  }

  if (mobileUa) {
    if (isAndroid) {
      window.location.assign(sharerM);
      return;
    }
    // iOS: after share API unavailable/cancelled — new tab to www; avoid assign(m.) which tends to hand off to the app without `u`
    const w = window.open(sharerWww, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
    else window.location.assign(sharerWww);
    return;
  }

  openFacebookSharerPopup(sharerWww);
}

function extFromType(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  return 'jpg';
}

async function tryNativeMediaShare(absUrl: string, mediaUrl?: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator.share !== 'function' || !mediaUrl) return false;
  try {
    const mediaAbs = getAbsoluteShareUrl(mediaUrl);
    const res = await fetch(mediaAbs, { mode: 'cors' });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (!blob || !blob.type) return false;
    const file = new File([blob], `share.${extFromType(blob.type)}`, { type: blob.type });
    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file] });
    return true;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return true;
    return false;
  }
}

export function SocialShareButtons({ url, title, text, mediaUrl, className = '' }: SocialShareButtonsProps) {
  const safeTitle = stripHtml(title).trim() || title;
  const fromText = text?.trim() ? stripHtml(text).trim() : '';
  const shareText = (fromText || safeTitle).trim() || title;
  const absUrl = getAbsoluteShareUrl(url);

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?url=${encoded(absUrl)}&text=${encoded(shareText)}`,
    whatsapp: `https://wa.me/?text=${encoded(shareText + ' ' + absUrl)}`,
  };

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
          onClick={async () => {
            if (await tryNativeMediaShare(absUrl, mediaUrl)) return;
            await openFacebookShare(url, safeTitle, shareText);
          }}
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

