/**
 * Helpers for downloading listing photos/videos (Cloudinary CDN).
 */

import { isDefaultListingImageUrl } from '@/lib/listing-default-image';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'listing-media';
}

function extFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-z0-9]{2,5})$/i);
    if (m) return m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Insert Cloudinary `fl_attachment[:filename]` so the browser downloads instead of navigating. */
export function withCloudinaryAttachment(url: string, filename?: string): string {
  if (!url.includes('res.cloudinary.com')) return url;
  const attachment = filename
    ? `fl_attachment:${encodeURIComponent(sanitizeFilename(filename))}`
    : 'fl_attachment';
  if (/\/(image|video)\/upload\/.*fl_attachment/.test(url)) return url;
  return url.replace(
    /\/(image|video)\/upload\//,
    (_m, kind: string) => `/${kind}/upload/${attachment}/`
  );
}

export function buildListingMediaDownloadFilename(
  title: string,
  kind: 'image' | 'video',
  index: number,
  url: string
): string {
  const base = sanitizeFilename(title) || 'listing';
  const ext = extFromUrl(url, kind === 'video' ? 'mp4' : 'jpg');
  const label = kind === 'video' ? 'video' : 'photo';
  return `${base}-${label}-${index + 1}.${ext}`;
}

export function isDownloadableListingMedia(url: string | undefined, publicId?: string): boolean {
  if (!url) return false;
  if (publicId === 'default-media' || publicId?.startsWith('default-')) return false;
  if (isDefaultListingImageUrl(url)) return false;
  return true;
}

/**
 * Trigger a file download. Prefers Cloudinary fl_attachment; falls back to blob fetch.
 */
export async function downloadListingMedia(opts: {
  url: string;
  filename: string;
}): Promise<void> {
  const { url, filename } = opts;
  const attachmentUrl = withCloudinaryAttachment(url, filename.replace(/\.[^.]+$/, ''));

  try {
    const res = await fetch(attachmentUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      return;
    }
  } catch {
    /* fall through to navigation download */
  }

  const a = document.createElement('a');
  a.href = attachmentUrl;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
