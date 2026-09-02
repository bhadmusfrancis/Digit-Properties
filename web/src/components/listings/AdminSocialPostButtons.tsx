'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { facebookPostUrl, twitterPostUrl, type SocialPlatform } from '@/lib/listing-social-post';

type Props = {
  listingId: string;
  facebookPostId?: string | null;
  twitterPostId?: string | null;
  facebookConfigured: boolean;
  twitterConfigured: boolean;
  variant?: 'panel' | 'compact';
};

type PlatformResult = {
  ok?: boolean;
  skipped?: boolean;
  alreadyPosted?: boolean;
  postId?: string;
  url?: string;
  error?: string;
};

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function summarizeResult(label: string, result?: PlatformResult): string | null {
  if (!result) return null;
  if (result.ok) return `${label}: posted.`;
  if (result.skipped && result.alreadyPosted) return `${label}: already posted (skipped).`;
  if (result.error) return `${label}: ${result.error}`;
  return null;
}

export function AdminSocialPostButtons({
  listingId,
  facebookPostId,
  twitterPostId,
  facebookConfigured,
  twitterConfigured,
  variant = 'panel',
}: Props) {
  const router = useRouter();
  const [facebookId, setFacebookId] = useState(facebookPostId || '');
  const [twitterId, setTwitterId] = useState(twitterPostId || '');
  const [facebookOn, setFacebookOn] = useState(facebookConfigured);
  const [twitterOn, setTwitterOn] = useState(twitterConfigured);
  const [busy, setBusy] = useState<SocialPlatform | null>(null);

  useEffect(() => {
    setFacebookId(facebookPostId || '');
    setTwitterId(twitterPostId || '');
  }, [facebookPostId, twitterPostId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/listings/${listingId}/social-post`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { facebook?: boolean; twitter?: boolean } | null) => {
        if (cancelled || !d) return;
        if (typeof d.facebook === 'boolean') setFacebookOn(d.facebook);
        if (typeof d.twitter === 'boolean') setTwitterOn(d.twitter);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const compact = variant === 'compact';
  const anyConfigured = facebookOn || twitterOn;

  async function post(platform: SocialPlatform) {
    if (busy) return;
    if (platform === 'facebook' && !facebookOn) return;
    if (platform === 'twitter' && !twitterOn) return;
    if (platform === 'both' && !anyConfigured) return;

    const facebookAgain = (platform === 'facebook' || platform === 'both') && Boolean(facebookId);
    const twitterAgain = (platform === 'twitter' || platform === 'both') && Boolean(twitterId);
    if (facebookAgain || twitterAgain) {
      const parts: string[] = [];
      if (facebookAgain) parts.push('Facebook');
      if (twitterAgain) parts.push('X');
      const ok = window.confirm(`Already posted to ${parts.join(' and ')}. Post again?`);
      if (!ok) return;
    }

    setBusy(platform);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/social-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, force: facebookAgain || twitterAgain }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyPosted?: boolean;
        facebook?: PlatformResult;
        twitter?: PlatformResult;
      };

      if (res.status === 409 && data.alreadyPosted) {
        const ok = window.confirm(`${data.error || 'Already posted.'} Post again?`);
        if (!ok) return;
        const retry = await fetch(`/api/admin/listings/${listingId}/social-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, force: true }),
        });
        const retryData = (await retry.json().catch(() => ({}))) as typeof data;
        applyResult(retry, retryData);
        return;
      }

      applyResult(res, data);
    } catch {
      alert('Failed to post listing');
    } finally {
      setBusy(null);
    }
  }

  function applyResult(
    res: Response,
    data: { error?: string; facebook?: PlatformResult; twitter?: PlatformResult }
  ) {
    if (data.facebook?.ok && data.facebook.postId) setFacebookId(data.facebook.postId);
    if (data.twitter?.ok && data.twitter.postId) setTwitterId(data.twitter.postId);

    const lines = [
      summarizeResult('Facebook', data.facebook),
      summarizeResult('X', data.twitter),
    ].filter(Boolean) as string[];
    if (!res.ok && lines.length === 0) {
      alert(typeof data.error === 'string' ? data.error : 'Failed to post listing');
      return;
    }
    if (lines.length) alert(lines.join('\n'));
    else if (!res.ok) alert(typeof data.error === 'string' ? data.error : 'Failed to post listing');
    if (data.facebook?.ok || data.twitter?.ok) router.refresh();
  }

  const facebookHref = facebookId ? facebookPostUrl(facebookId) : null;
  const twitterHref = twitterId ? twitterPostUrl(twitterId) : null;
  const facebookLabel = compact
    ? facebookId
      ? 'FB posted'
      : 'FB'
    : facebookId
      ? 'Posted to Facebook'
      : 'Post to Facebook';
  const twitterLabel = compact ? (twitterId ? 'X posted' : 'X') : twitterId ? 'Posted to X' : 'Post to X';

  const btn = compact
    ? 'inline-flex min-h-[32px] items-center justify-center gap-1 rounded border px-2 text-[11px] font-semibold disabled:opacity-50 touch-manipulation'
    : 'inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-50';

  return (
    <div className={compact ? 'inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1' : 'mt-3 space-y-2'}>
      {!compact ? (
        <h4 className="text-sm font-medium text-gray-900">Post to social</h4>
      ) : null}
      <button
        type="button"
        onClick={() => post('facebook')}
        disabled={busy !== null || !facebookOn}
        title={
          facebookOn
            ? 'Publish this listing and its photos/video to the Facebook Page'
            : 'Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in env'
        }
        className={`${btn} border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100`}
      >
        <FacebookIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {busy === 'facebook' ? (compact ? '…' : 'Posting…') : facebookLabel}
      </button>
      <button
        type="button"
        onClick={() => post('twitter')}
        disabled={busy !== null || !twitterOn}
        title={
          twitterOn
            ? 'Publish this listing and its photos/video to the X page'
            : 'Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET in env'
        }
        className={`${btn} border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100`}
      >
        <XIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {busy === 'twitter' ? (compact ? '…' : 'Posting…') : twitterLabel}
      </button>
      {!compact ? (
        <button
          type="button"
          onClick={() => post('both')}
          disabled={busy !== null || !anyConfigured}
          title="Publish to Facebook Page and X"
          className={`${btn} border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100`}
        >
          {busy === 'both' ? 'Posting…' : 'Post to Facebook & X'}
        </button>
      ) : null}
      {!compact && (facebookHref || twitterHref) ? (
        <p className="text-xs text-gray-600">
          {facebookHref ? (
            <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
              View Facebook post
            </a>
          ) : null}
          {facebookHref && twitterHref ? ' · ' : null}
          {twitterHref ? (
            <a href={twitterHref} target="_blank" rel="noopener noreferrer" className="text-slate-800 hover:underline">
              View X post
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
