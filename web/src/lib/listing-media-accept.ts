/** Allowed MIME types for `/api/upload` in listing flows (images + video). */
export const LISTING_FILE_UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';

/** Prefer picking videos from library (no `capture`) so gallery opens on mobile. */
export const LISTING_VIDEO_PICK_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/*';

export function fileLooksLikeVideo(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('video/')) return true;
  const n = file.name.toLowerCase();
  return /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/.test(n);
}
