/** Allowed MIME types for `/api/upload` in listing flows (images + video). */
export const LISTING_FILE_UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/3gpp,video/*';

/** Prefer picking videos from library (no `capture`) so gallery opens on mobile. */
export const LISTING_VIDEO_PICK_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/3gpp,video/*';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const KNOWN_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/3gpp',
  'video/3gpp2',
  'video/x-matroska',
  'video/x-msvideo',
]);

/**
 * Classify listing media for `/api/upload` and direct Cloudinary uploads. Many mobile
 * browsers send empty or `application/octet-stream` for gallery videos; we fall back
 * to the filename.
 */
export function classifyListingUploadParts(
  fileName: string,
  mimeType: string,
  fileSize: number
): 'image' | 'video' | null {
  const type = (mimeType || '').trim().toLowerCase();
  const videoByExt = /\.(mp4|webm|mov|m4v|mkv|avi|ogv|3gp|3g2|qt)$/i.test(fileName);
  const imageByExt = /\.(jpe?g|png|webp)$/i.test(fileName);

  const isImageMime = ALLOWED_IMAGE_MIMES.has(type);
  const isVideoMime = KNOWN_VIDEO_MIMES.has(type) || type.startsWith('video/');

  if (isImageMime && !isVideoMime) return 'image';
  if (isVideoMime) return 'video';

  if (!type || type === 'application/octet-stream') {
    if (videoByExt && !imageByExt) return 'video';
    if (imageByExt && !videoByExt) return 'image';
    if (videoByExt && imageByExt) {
      return fileSize > 12 * 1024 * 1024 ? 'video' : 'image';
    }
    return null;
  }

  if (type.startsWith('image/')) return null;

  return null;
}

export function classifyListingUploadFile(file: File): 'image' | 'video' | null {
  return classifyListingUploadParts(file.name, file.type, file.size);
}

export function fileLooksLikeVideo(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('video/')) return true;
  const n = file.name.toLowerCase();
  return /\.(mp4|webm|mov|m4v|mkv|avi|ogv|3gp|qt)$/i.test(n);
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
