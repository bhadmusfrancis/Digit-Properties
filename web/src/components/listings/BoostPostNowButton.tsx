'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOOST_PACKAGES, type BoostPackage } from '@/lib/boost-packages';
import { useSystemToast } from '@/components/ui/SystemToast';

function socialWarning(pkg: BoostPackage): string {
  if (pkg.socialFacebook && pkg.socialTwitter) {
    return 'It will also publish this listing to Facebook and X.';
  }
  if (pkg.socialFacebook) {
    return 'It will also publish this listing to the Digit Properties Facebook Page.';
  }
  if (pkg.socialTwitter) {
    return 'It will also publish this listing to X.';
  }
  return 'This package is on-site only and will not post to social media.';
}

export function BoostPostNowButton({
  listingId,
  boostPackage,
  className = '',
}: {
  listingId: string;
  boostPackage?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const notify = useSystemToast();
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const pkg = BOOST_PACKAGES[(boostPackage || 'starter') as BoostPackage['id']] ?? BOOST_PACKAGES.starter;

  async function confirmPost() {
    if (posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/boost-post`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error('Could not boost post', typeof data.error === 'string' ? data.error : 'Please try again.');
        return;
      }
      const platforms = [data.facebook?.ok && 'Facebook', data.twitter?.ok && 'X'].filter(Boolean);
      notify.success(
        'Boost posted',
        platforms.length
          ? `Listing locked. Published to ${platforms.join(' and ')}.`
          : data.warning || 'Listing locked. Further edits are disabled until the boost expires.'
      );
      setOpen(false);
      router.refresh();
    } finally {
      setPosting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 px-3 py-2 text-white shadow-md shadow-indigo-500/25 transition hover:from-sky-700 hover:via-indigo-600 hover:to-violet-700 disabled:opacity-50 sm:w-auto sm:min-w-[200px]'
        }
      >
        <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
        </svg>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="text-sm font-extrabold tracking-tight">Boost Post Now</span>
          <span className="text-[10px] font-medium text-white/85">Locks edits and publishes</span>
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Lock this listing?</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Boost Post Now will lock further edits. You will not be able to change photos, videos,
              categories, or other details until the boost expires — or you pay to extend the boost.
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">{socialWarning(pkg)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={confirmPost}
                disabled={posting}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {posting ? 'Posting…' : 'Yes, boost post now'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={posting}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
