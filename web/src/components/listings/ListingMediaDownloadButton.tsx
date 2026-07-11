'use client';

import { useState, useCallback } from 'react';
import {
  buildListingMediaDownloadFilename,
  downloadListingMedia,
  isDownloadableListingMedia,
} from '@/lib/media-download';

type Props = {
  url: string;
  public_id?: string;
  title: string;
  /** 0-based index among listing videos (for filename). */
  videoIndex?: number;
};

export function ListingMediaDownloadButton({ url, public_id, title, videoIndex = 0 }: Props) {
  const [downloading, setDownloading] = useState(false);
  const canDownload = isDownloadableListingMedia(url, public_id);

  const onClick = useCallback(async () => {
    if (!canDownload || downloading) return;
    const filename = buildListingMediaDownloadFilename(title, 'video', videoIndex, url);
    setDownloading(true);
    try {
      await downloadListingMedia({ url, filename });
    } finally {
      setDownloading(false);
    }
  }, [canDownload, downloading, title, url, videoIndex]);

  if (!canDownload) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={downloading}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
      aria-label="Download video"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {downloading ? 'Downloading…' : 'Download video'}
    </button>
  );
}
