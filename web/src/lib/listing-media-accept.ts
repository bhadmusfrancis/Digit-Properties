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

/** How many files from this list will be attempted given remaining image/video slots (client-side guess). */
export function countPlannedMediaUploads(files: FileList, imgRoom: number, vidRoom: number): number {
  let ir = Math.max(0, imgRoom);
  let vr = Math.max(0, vidRoom);
  let count = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (fileLooksLikeVideo(file)) {
      if (vr > 0) {
        count++;
        vr--;
      }
    } else if (ir > 0) {
      count++;
      ir--;
    }
  }
  return count;
}
